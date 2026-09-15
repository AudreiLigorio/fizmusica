import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

// Cota diária de palmas. 30 com teto de 10 por música: permite aplaudir três
// músicas de pé no mesmo dia. Com 10 a pessoa aplaudiria uma vez e acabou o
// dia — escassez demais vira desistência, não decisão.
const COTA_DIA = 30

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? null
  if (!token) return null
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data } = await anon.auth.getUser(token)
  return data?.user ?? null
}

// A mesma trava do catálogo e da página pública: só música publicada e
// entregue. Sem isto daria pra aplaudir (e inflar o destaque de) música que
// não está na Rede — bastaria saber o id.
async function publicada(supabase: ReturnType<typeof createServerClient>, orderId: string) {
  const { data } = await supabase
    .from("orders").select("publication_consent, status").eq("id", orderId).maybeSingle()
  return data?.publication_consent === true && data.status === "DELIVERED"
}

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("orderId")
  if (!orderId) return NextResponse.json({ error: "Música inválida." }, { status: 400 })

  const supabase = createServerClient()
  const user = await getUser(req)

  // Leitura vem do banco (migração 062), não montada aqui: o "início do dia"
  // é o da cota, e calcular isso em JavaScript criaria uma segunda definição
  // de "hoje" — livre pra divergir da que cobra. O dia é o de BRASÍLIA;
  // com o fuso do servidor a cota virava às 21h.
  //
  // Visitante vê o total (o aplauso é público) e volta com `resta` nulo:
  // dar palma exige conta, como favoritar e montar playlist.
  const { data, error } = await supabase.rpc("aplauso_estado", {
    p_order_id: orderId,
    p_user_id: user?.id ?? null,
    p_cota_dia: COTA_DIA,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const r = Array.isArray(data) ? data[0] : data
  return NextResponse.json({
    total: Number(r?.total ?? 0),
    minhas: r?.minhas ?? 0,
    resta: r?.resta ?? null,
    cota: COTA_DIA,
  })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: "Crie sua conta pra aplaudir." }, { status: 401 })

  const { orderId, palmas } = await req.json().catch(() => ({}))
  const n = Number(palmas)
  if (!orderId || !Number.isInteger(n) || n < 1 || n > 10) {
    return NextResponse.json({ error: "Aplauso inválido." }, { status: 400 })
  }

  const supabase = createServerClient()
  if (!(await publicada(supabase, orderId))) {
    return NextResponse.json({ error: "Esta música não está na Rede." }, { status: 403 })
  }

  // Toda a regra vive no banco (migração 061): só aumenta, e só a diferença
  // sai da cota. Aqui não dá pra repetir isso sem correr o risco de duas
  // pessoas aplaudindo ao mesmo tempo furarem a conta.
  const { data, error } = await supabase.rpc("aplaudir", {
    p_order_id: orderId,
    p_user_id: user.id,
    p_palmas: n,
    p_cota_dia: COTA_DIA,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const r = Array.isArray(data) ? data[0] : data
  return NextResponse.json({ total: Number(r?.total ?? 0), minhas: r?.minhas ?? 0, resta: r?.resta ?? 0, cota: COTA_DIA })
}
