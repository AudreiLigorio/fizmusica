import { NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getComposerSettings } from "@/lib/composer/settings"
import { buildOrderContext } from "@/lib/composer/context"
import { generateLyricsStream } from "@/lib/composer/gemini"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServerClient()

  const { data: order } = await supabase
    .from("orders")
    .select("id, paymentStatus, lyricsApproved")
    .eq("id", id)
    .single()

  if (!order) return new Response(JSON.stringify({ error: "Pedido não encontrado." }), { status: 404, headers: { "Content-Type": "application/json" } })
  if (order.paymentStatus !== "PAID") return new Response(JSON.stringify({ error: "Pedido ainda não está pago." }), { status: 403, headers: { "Content-Type": "application/json" } })
  if (order.lyricsApproved) return new Response(JSON.stringify({ error: "A letra já foi aprovada." }), { status: 409, headers: { "Content-Type": "application/json" } })

  const context = await buildOrderContext(id)
  if (!context) return new Response(JSON.stringify({ error: "Não foi possível montar o contexto do pedido." }), { status: 400, headers: { "Content-Type": "application/json" } })

  const settings = await getComposerSettings()

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      let fullText = ""
      try {
        const chunks = await generateLyricsStream({
          systemPrompt: settings.prompt,
          model: settings.model,
          location: settings.location,
          userContent: context,
        })
        for await (const chunk of chunks) {
          fullText += chunk
          controller.enqueue(enc.encode(chunk))
        }
        if (!fullText.trim()) throw new Error("A IA não retornou letra.")
        await supabase.from("orders").update({ lyricsDraft: fullText.trim() }).eq("id", id)
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro ao gerar a letra."
        console.error("[letra/gerar]", msg)
        controller.enqueue(enc.encode(`\x00ERR:${msg}`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Accel-Buffering": "no",
      "Cache-Control": "no-cache",
    },
  })
}
