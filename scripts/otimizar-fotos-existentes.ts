// Reprocessa fotos JÁ enviadas, aplicando a mesma compressão que o upload
// passou a fazer (lib/imageResize.ts). Serve pros pedidos que entraram antes
// da compressão existir.
//
//   npm run fotos:otimizar -- --dry <orderId…>   (só simula, não escreve)
//   npm run fotos:otimizar -- <orderId…>         (reprocessa esses pedidos)
//   npm run fotos:otimizar -- --todos            (reprocessa tudo)
//
// ⚠️ Sobrescreve o arquivo do cliente no MESMO caminho, de propósito: a URL
// já está gravada no banco, pode ter sido compartilhada por link e aparece em
// QR Code impresso. Trocar o caminho quebraria isso. Como é irreversível,
// o --dry existe pra conferir antes.
import { createServerClient } from "@/lib/supabase"
import { otimizarFoto } from "@/lib/imageResize"

const BUCKET = "order-photos"

const args = process.argv.slice(2)
const dry = args.includes("--dry")
const todos = args.includes("--todos")
const pedidos = args.filter((a) => !a.startsWith("--"))

const mb = (n: number) => (n / 1024 / 1024).toFixed(2) + " MB"

async function main() {
  if (!todos && pedidos.length === 0) {
    console.error("Informe ao menos um orderId, ou --todos.")
    process.exit(1)
  }

  const supabase = createServerClient()

  let query = supabase.from("order_photos").select("id, orderId, url, storage_path")
  if (!todos) query = query.in("orderId", pedidos)
  const { data: fotos, error } = await query
  if (error) throw new Error(error.message)
  if (!fotos?.length) {
    console.log("Nenhuma foto encontrada.")
    return
  }

  console.log(`${fotos.length} foto(s)${dry ? " — SIMULAÇÃO, nada será escrito" : ""}\n`)

  let antes = 0
  let depois = 0
  let pulos = 0

  for (const foto of fotos) {
    const res = await fetch(foto.url)
    if (!res.ok) {
      console.log(`  ⚠️  ${foto.storage_path} — não baixou (HTTP ${res.status}), pulando`)
      pulos++
      continue
    }
    const original = new Uint8Array(await res.arrayBuffer())

    // Só sobrescreve caminho .jpg/.jpeg: gravar bytes JPEG num arquivo .png
    // deixaria o Content-Type mentindo sobre o conteúdo.
    if (!/\.jpe?g$/i.test(foto.storage_path)) {
      console.log(`  ⏭️  ${foto.storage_path} — não é .jpg, pulando`)
      pulos++
      continue
    }

    const otimizada = await otimizarFoto(original)
    antes += otimizada.bytesAntes
    depois += otimizada.bytesDepois

    const ganho = 1 - otimizada.bytesDepois / otimizada.bytesAntes
    const rotulo = `${mb(otimizada.bytesAntes)} → ${mb(otimizada.bytesDepois)} (${(ganho * 100).toFixed(0)}%)`

    if (ganho < 0.05) {
      console.log(`  ⏭️  ${foto.storage_path.slice(-24)} — já está enxuta, mantida`)
      pulos++
      continue
    }

    if (dry) {
      console.log(`  ○  ${foto.storage_path.slice(-24)} — ${rotulo}`)
      continue
    }

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(foto.storage_path, otimizada.bytes, { contentType: "image/jpeg", upsert: true })

    if (upErr) {
      console.log(`  ❌ ${foto.storage_path.slice(-24)} — falhou: ${upErr.message}`)
      pulos++
      continue
    }
    console.log(`  ✓  ${foto.storage_path.slice(-24)} — ${rotulo}`)
  }

  console.log(
    `\nTotal: ${mb(antes)} → ${mb(depois)} ` +
    `(${antes ? ((1 - depois / antes) * 100).toFixed(0) : 0}% menor) · ${pulos} pulada(s)` +
    (dry ? "\nSimulação — nada foi escrito." : ""),
  )
}

main().catch((e) => {
  console.error("[fotos] erro:", e instanceof Error ? e.message : e)
  process.exit(1)
})
