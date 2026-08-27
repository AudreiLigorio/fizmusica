import { NextRequest, NextResponse, after } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createOrder, triggerN8nWebhook } from "@/app/services/orderService"
import { sendOrderConfirmationEmail, sendOrderNotificationEmail } from "@/app/services/emailService"
import { createOrderSchema } from "@/lib/validators/order"
import { createServerClient } from "@/lib/supabase"
import { extractClientIp, lookupState } from "@/lib/geoip"
import { toE164 } from "@/lib/n8n/events"
import { PLAN_FEATURE_COLUMNS, featuresFromProduct } from "@/lib/planFeatures"
import { sincronizarPreviaNoPedido } from "@/lib/composer/aproveitarPrevia"
import { lrcToPlainLyrics } from "@/lib/suno/lrc"

export async function GET(req: NextRequest) {
  // Identidade: prioriza o token de login (Bearer) — busca por e-mail OU userId
  // (pedidos reivindicados). Sem token, mantém o modo legado por ?email=.
  const auth = req.headers.get("authorization") ?? ""
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : null
  let userId: string | null = null
  let email = req.nextUrl.searchParams.get("email")
  let emailConfirmado = false

  if (bearer) {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data } = await anon.auth.getUser(bearer)
    if (data.user) {
      userId = data.user.id
      email = data.user.email ?? email
      emailConfirmado = !!data.user.email_confirmed_at
    }
  }

  if (!email && !userId) return NextResponse.json({ orders: [] })

  const supabase = createServerClient()

  // Adota pedidos órfãos do MESMO e-mail. Sem isso, quem compra sem conta (a
  // jornada de quem vem de anúncio) e só depois se cadastra fica com os
  // pedidos sem dono pra sempre — e a fidelidade nunca credita disco, porque
  // ela pendura tudo em user_id. Foi o que obrigou um backfill manual de 58
  // pedidos em 2026-08-27.
  //
  // TRÊS TRAVAS, e nenhuma é dispensável:
  //
  // 1. E-mail CONFIRMADO. É a prova de que a pessoa controla o endereço. Hoje
  //    o Supabase já exige confirmação pra criar sessão, mas não dependemos
  //    disso: se essa configuração mudar, contas não verificadas não podem
  //    herdar pedido de ninguém. Existe conta não confirmada com pedido pago.
  // 2. Só pedido SEM dono. Nunca reatribui o que já é de outra conta.
  // 3. Igualdade exata do e-mail normalizado — mesma regra que já decide o que
  //    a tela mostra, então não amplia acesso: só grava o que já era exibido.
  if (userId && emailConfirmado && email) {
    const alvo = email.trim().toLowerCase()
    const { error: vincErr } = await supabase
      .from("orders")
      .update({ userId })
      .is("userId", null)
      .eq("email", alvo)
    if (vincErr) console.error("[orders] vínculo automático falhou:", vincErr.message)
  }
  const filter = [email ? `email.eq.${email}` : null, userId ? `userId.eq.${userId}` : null].filter(Boolean).join(",")

  const { data, error } = await supabase
    .from("orders")
    .select(`id, nome, email, whatsapp, context, subcategory, musicalStyle, voiceType, emotion, honoreeName, status, paymentStatus, createdAt, photo_token, is_revision, sharing_term_accepted_at, lyricsApproved, productId, sunoStatus, sunoTracks, publication_consent, shipping_name, shipping_cep, shipping_address, shipping_number, shipping_complement, shipping_neighborhood, shipping_city, shipping_state, shipping_phone, products(name, price, ${PLAN_FEATURE_COLUMNS}), payments(amount, mpStatus, paidAt), order_photos(id), order_answers(question, answer, position)`)
    .or(filter)
    .order("createdAt", { ascending: false })

  if (error) return NextResponse.json({ orders: [] })

  // Prazo do link público — hoje é único pra todos os produtos
  // (purge_settings.music_days). A tela mostra o número em vez de dizer só
  // "expirou", pra o cliente conferir contra o que foi contratado.
  const { data: purge } = await supabase
    .from("purge_settings").select("music_days, music_enabled").eq("id", 1).maybeSingle()
  const linkPrazoDias = purge?.music_enabled ? (purge.music_days as number | null) ?? null : null

  // Anexa slug + mp3 da música (quando publicada) para os botões Ouvir/Baixar
  const ids = (data ?? []).map((o) => o.id)
  const musicByOrder: Record<string, { slug: string | null; mp3Url: string | null; lyrics: string | null; lyricsLrc: string | null; musicName: string | null; linkAtivo: boolean }> = {}
  if (ids.length) {
    const { data: gm } = await supabase
      .from("generated_music")
      .select("orderId, slug, mp3Url, lyrics, lyricsLrc, musicName, link_disabled_at")
      .in("orderId", ids)
    for (const g of gm ?? []) musicByOrder[g.orderId as string] = { slug: g.slug ?? null, mp3Url: g.mp3Url ?? null, lyrics: g.lyrics ?? null, lyricsLrc: g.lyricsLrc ?? null, musicName: g.musicName ?? null, linkAtivo: !g.link_disabled_at }
  }

  const orders = (data ?? []).map((o) => {
    // Renomeia sunoStatus/sunoTracks para nomes neutros na resposta — a chave literal
    // do JSON é o único lugar onde "suno" chegaria ao cliente (via DevTools/Network).
    const { order_photos, order_answers, sunoStatus, sunoTracks, payments, ...rest } = o as typeof o & {
      order_photos?: { id: string }[]
      order_answers?: { question: string; answer: string; position: number }[]
      sunoStatus?: string | null
      sunoTracks?: unknown
      payments?: unknown
    }
    const answers = Array.isArray(order_answers)
      ? [...order_answers].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      : []
    // Supabase embute payments como ARRAY mesmo com orderId único — normaliza pra
    // objeto único (já inclui entrega+cupom, calculado em /api/payments/create).
    const paymentRow = Array.isArray(payments) ? (payments[0] ?? null) : (payments ?? null)
    // Recursos já resolvidos aqui: a tela não precisa saber o nome das colunas
    // nem repetir o "?? true" de cada uma pra decidir o que mostrar.
    const produto = Array.isArray(rest.products) ? rest.products[0] : rest.products
    const features = featuresFromProduct(produto)
    const music = musicByOrder[o.id]
    // Mesma trava do player público (app/m/[slug]/page.tsx): sem o recurso no
    // plano, a letra continua (só perde o acompanhamento sincronizado).
    const lyrics = features.letraSincronizada
      ? music?.lyrics ?? null
      : (music?.lyrics?.trim() || (music?.lyricsLrc ? lrcToPlainLyrics(music.lyricsLrc) : null))
    const lyricsLrc = features.letraSincronizada ? music?.lyricsLrc ?? null : null
    return {
      ...rest,
      musicStatus: sunoStatus ?? null,
      tracks:      sunoTracks ?? null,
      slug:       music?.slug ?? null,
      mp3Url:     music?.mp3Url ?? null,
      // Nome escolhido pelo cliente ao aprovar a letra. A prateleira usa este
      // em vez do title cru do Suno, que costuma ser o nome do homenageado.
      musicName:  music?.musicName ?? null,
      // Link público vencido (expurgo). A música continua ouvível e baixável
      // aqui dentro — o que morre é o /m/slug, então QR e compartilhar
      // precisam sumir, senão o cliente divulga um link quebrado.
      linkAtivo:  music ? music.linkAtivo : true,
      linkPrazoDias,
      lyrics,
      lyricsLrc,
      photoCount: Array.isArray(order_photos) ? order_photos.length : 0,
      features,
      answers,
      payments: paymentRow,
    }
  })
  return NextResponse.json({ orders })
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json()
    const parsed = createOrderSchema.safeParse(raw)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const body = parsed.data
    const customerIp = extractClientIp(req.headers)

    // Salva no banco
    const order = await createOrder(body, customerIp)

    // Atribuição de indicação: se o visitante passou por /i/[code] nos últimos
    // 30 dias, o cookie carrega o código até aqui. Conversão é derivada depois
    // (referral_code + paymentStatus=PAID), não precisa tocar no fluxo de
    // pagamento — ver prisma/migrations/047_referral.sql.
    const referralCode = req.cookies.get("fm_ref")?.value
    if (referralCode) {
      await createServerClient().from("orders").update({ referral_code: referralCode.toUpperCase() }).eq("id", order.id)
    }

    // Dispara e-mails e n8n APÓS a resposta (after garante execução mesmo após response)
    const emailData = {
      orderId: order.id,
      nome: order.nome,
      email: order.email,
      whatsapp: order.whatsapp,
      context: order.context,
      subcategory: order.subcategory,
      musicalStyle: order.musicalStyle,
      voiceType: order.voiceType,
      emotion: order.emotion,
      createdAt: order.createdAt,
    }
    after(async () => {
      // Antes dos e-mails: se a pessoa viu o refrão no wizard, aquela letra vira
      // o rascunho do pedido. Roda aqui pra não atrasar a ida ao /produtos — só
      // é necessária depois do pagamento, minutos à frente.
      if (body.sessionId) await sincronizarPreviaNoPedido(order.id, body.sessionId)

      if (customerIp) {
        const geo = await lookupState(customerIp)
        if (geo.state) {
          await createServerClient().from("orders").update({ customer_state: geo.state }).eq("id", order.id)
        }
      }
      await sendOrderConfirmationEmail(emailData)
      await sendOrderNotificationEmail(emailData)
      await triggerN8nWebhook({
        event: "order.created",
        orderId: order.id,
        nome: order.nome,
        whatsapp: order.whatsapp,
        whatsappE164: toE164(order.whatsapp),
        email: order.email,
        context: order.context,
        subcategory: order.subcategory,
        musicalStyle: order.musicalStyle,
        voiceType: order.voiceType,
        emotion: order.emotion,
        answers: body.answers,
        createdAt: order.createdAt.toISOString(),
      })
    })

    return NextResponse.json(
      { success: true, orderId: order.id },
      { status: 201 }
    )
  } catch (error) {
    console.error("[POST /api/orders]", JSON.stringify(error))
    return NextResponse.json(
      { success: false, error: "Erro interno. Tente novamente." },
      { status: 500 }
    )
  }
}
