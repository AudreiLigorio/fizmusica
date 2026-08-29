// Move as capas do bucket `songs` (privado) para `covers` (público).
//
// Contexto: no resgate de fd6776a as capas deixaram de ser link externo que
// expira e foram salvas em `songs`, junto do MP3. Quando `songs` ficou
// privado (proteção contra download, 90508d4), as capas quebraram junto — a
// Rede inteira ficou sem imagem.
//
// A capa NÃO é dado pessoal: é arte gerada pela IA, mostrada publicamente no
// catálogo. Diferente do MP3 (o produto) e da foto do cliente (dado
// pessoal). Então o lugar dela é um bucket público — o que também preserva o
// cache de CDN: servir 40 capas por página pela nossa função seria 40
// invocações por visita, logo depois do trabalho que derrubou o payload.
//
//   node scripts/mover-capas.mjs           (simulação)
//   node scripts/mover-capas.mjs --gravar
import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const GRAVAR = process.argv.includes("--gravar")
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

// Só capa: o MP3 fica em `songs`, que continua privado de propósito.
function caminhoDaCapa(url) {
  const m = (url ?? "").match(/\/storage\/v1\/object\/(?:public|sign)\/songs\/(.+?\/capa-[^/?]+)(?:\?|$)/)
  return m ? decodeURIComponent(m[1]) : null
}

const { data: orders, error } = await supabase
  .from("orders")
  .select("id, sunoTracks")
  .not("sunoTracks", "is", null)

if (error) {
  console.error("erro ao ler pedidos:", error.message)
  process.exit(1)
}

let movidas = 0, falhas = 0, jaOk = 0, semCapa = 0, pedidos = 0

for (const o of orders ?? []) {
  const tracks = o.sunoTracks ?? []
  let mudou = false

  for (const t of tracks) {
    if (!t.imageUrl) { semCapa++; continue }
    if (t.imageUrl.includes("/covers/")) { jaOk++; continue }

    const caminho = caminhoDaCapa(t.imageUrl)
    if (!caminho) { semCapa++; continue }

    if (!GRAVAR) { movidas++; continue }

    const { data: blob, error: dlErr } = await supabase.storage.from("songs").download(caminho)
    if (dlErr || !blob) {
      console.warn(`  falha ao baixar ${caminho}: ${dlErr?.message}`)
      falhas++
      continue
    }
    const { error: upErr } = await supabase.storage
      .from("covers")
      .upload(caminho, Buffer.from(await blob.arrayBuffer()), {
        contentType: blob.type || "image/jpeg",
        upsert: true,
        cacheControl: "31536000",
      })
    if (upErr) {
      console.warn(`  falha ao enviar ${caminho}: ${upErr.message}`)
      falhas++
      continue
    }
    t.imageUrl = supabase.storage.from("covers").getPublicUrl(caminho).data.publicUrl
    movidas++
    mudou = true
  }

  if (GRAVAR && mudou) {
    const { error: upErr } = await supabase.from("orders").update({ sunoTracks: tracks }).eq("id", o.id)
    if (upErr) console.error(`  ERRO ao gravar pedido ${o.id}:`, upErr.message)
    else pedidos++
  }
}

console.log()
console.log(GRAVAR ? "=== GRAVADO ===" : "=== SIMULAÇÃO (nada foi gravado) ===")
console.log("capas movidas:    ", movidas)
console.log("já estavam em covers:", jaOk)
console.log("sem capa:         ", semCapa)
console.log("falhas:           ", falhas)
if (GRAVAR) console.log("pedidos atualizados:", pedidos)
