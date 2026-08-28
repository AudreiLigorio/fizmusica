// Resgate das capas hospedadas fora.
//
// Até `lib/suno/ingest.ts` ser corrigido, o áudio era baixado pro nosso bucket
// mas a CAPA ficava como link direto pro host da KIE (musicfile.kie.ai,
// tempfile.aiquickdraw.com, cdn1.suno.ai) — todos temporários. Duas capas já
// tinham expirado e viraram quadrado preto na tela quando isso foi descoberto.
//
// Este script baixa o que ainda responde e regrava `orders.sunoTracks[].imageUrl`
// apontando pro nosso storage. Capa morta vira null: a tela cai no gradiente da
// marca, que é melhor do que uma imagem quebrada.
//
// Idempotente — URL que já é nossa é pulada. Pode rodar de novo sem risco.
//
//   node scripts/backfill-capas.mjs          (simulação, não grava)
//   node scripts/backfill-capas.mjs --gravar
import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const GRAVAR = process.argv.includes("--gravar")
const BUCKET = "songs"
const CACHE_1_ANO = "31536000"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

async function salvarCapa(srcUrl, orderId, audioId) {
  const resp = await fetch(srcUrl)
  if (!resp.ok) return { erro: `HTTP ${resp.status}` }
  const tipo = resp.headers.get("content-type") ?? "image/jpeg"
  const ext = tipo.includes("png") ? "png" : tipo.includes("webp") ? "webp" : "jpg"
  const buf = Buffer.from(await resp.arrayBuffer())
  const path = `${orderId}/capa-${audioId}.${ext}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: tipo, upsert: true, cacheControl: CACHE_1_ANO })
  if (error) return { erro: error.message }
  return { url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl }
}

const { data: orders, error } = await supabase
  .from("orders")
  .select("id, sunoTracks")
  .not("sunoTracks", "is", null)

if (error) {
  console.error("erro ao ler pedidos:", error.message)
  process.exit(1)
}

let salvas = 0, perdidas = 0, jaNossas = 0, pedidosTocados = 0

for (const o of orders ?? []) {
  const tracks = o.sunoTracks ?? []
  let mudou = false

  for (const t of tracks) {
    if (!t.imageUrl) continue
    if (t.imageUrl.includes("supabase.co")) { jaNossas++; continue }

    const audioId = t.audioId ?? t.audio_id
    if (!audioId) continue

    if (!GRAVAR) {
      // Simulação: só checa se ainda responde, sem baixar nem gravar.
      const r = await fetch(t.imageUrl, { method: "HEAD" }).catch(() => null)
      if (r?.ok) salvas++; else perdidas++
      continue
    }

    const res = await salvarCapa(t.imageUrl, o.id, audioId)
    if (res.url) {
      t.imageUrl = res.url
      salvas++
      mudou = true
    } else {
      // Capa perdida: null deixa a tela usar o gradiente da marca. Manter a
      // URL morta só garantiria um quadrado preto pra sempre.
      console.warn(`  perdida  ${o.id} / ${audioId}: ${res.erro}`)
      t.imageUrl = null
      perdidas++
      mudou = true
    }
  }

  if (GRAVAR && mudou) {
    const { error: upErr } = await supabase.from("orders").update({ sunoTracks: tracks }).eq("id", o.id)
    if (upErr) console.error(`  ERRO ao gravar pedido ${o.id}:`, upErr.message)
    else pedidosTocados++
  }
}

console.log()
console.log(GRAVAR ? "=== GRAVADO ===" : "=== SIMULAÇÃO (nada foi gravado) ===")
console.log("capas salvas:      ", salvas)
console.log("capas perdidas:    ", perdidas)
console.log("já eram nossas:    ", jaNossas)
if (GRAVAR) console.log("pedidos atualizados:", pedidosTocados)
