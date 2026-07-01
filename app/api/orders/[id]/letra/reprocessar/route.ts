import { NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getComposerSettings } from "@/lib/composer/settings"
import { buildOrderContext } from "@/lib/composer/context"
import { generateLyricsStream } from "@/lib/composer/gemini"
import { REPROCESS_LIMIT } from "../route"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { lyrics, instrucao } = await req.json().catch(() => ({}))
  const supabase = createServerClient()

  const { data: order } = await supabase
    .from("orders")
    .select("paymentStatus, lyricsApproved, lyricsReprocessCount, lyricsDraft")
    .eq("id", id)
    .single()

  if (!order) return new Response(JSON.stringify({ error: "Pedido não encontrado." }), { status: 404, headers: { "Content-Type": "application/json" } })
  if (order.paymentStatus !== "PAID") return new Response(JSON.stringify({ error: "Pedido ainda não está pago." }), { status: 403, headers: { "Content-Type": "application/json" } })
  if (order.lyricsApproved) return new Response(JSON.stringify({ error: "A letra já foi aprovada." }), { status: 409, headers: { "Content-Type": "application/json" } })

  const used = order.lyricsReprocessCount ?? 0
  if (used >= REPROCESS_LIMIT) {
    return new Response(JSON.stringify({ error: "Você já usou as 3 revisões com a IA. Pode ajustar o texto à mão e aprovar." }), { status: 429, headers: { "Content-Type": "application/json" } })
  }

  const atual = (lyrics ?? order.lyricsDraft ?? "").trim()
  if (!atual) return new Response(JSON.stringify({ error: "Não há letra para revisar. Gere a letra primeiro." }), { status: 400, headers: { "Content-Type": "application/json" } })

  const base = await buildOrderContext(id)
  const pedido = String(instrucao ?? "").trim() || "Revise e melhore mantendo a essência: corrija rimas e a fluência onde precisar, e incorpore naturalmente o que o cliente alterou."

  const userContent =
    `${base ?? ""}\n\n---\nLETRA ATUAL (base para a revisão):\n${atual}\n\n` +
    `AJUSTES PEDIDOS PELO CLIENTE:\n${pedido}`

  const settings = await getComposerSettings()
  const novoUso = used + 1

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      let fullText = ""
      try {
        const chunks = await generateLyricsStream({
          systemPrompt: settings.prompt,
          model: settings.model,
          location: settings.location,
          userContent,
        })
        for await (const chunk of chunks) {
          fullText += chunk
          controller.enqueue(enc.encode(chunk))
        }
        if (!fullText.trim()) throw new Error("A IA não retornou letra.")
        await supabase
          .from("orders")
          .update({ lyricsDraft: fullText.trim(), lyricsReprocessCount: novoUso })
          .eq("id", id)
        // Envia metadados de revisão ao final como marcador especial
        controller.enqueue(enc.encode(`\x00META:${JSON.stringify({ reprocessUsed: novoUso, reprocessLeft: Math.max(0, REPROCESS_LIMIT - novoUso) })}`))
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro ao revisar a letra."
        console.error("[letra/reprocessar]", msg)
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
