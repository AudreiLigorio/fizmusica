"use client"

import { useState } from "react"

type Product = {
  id: string
  name: string
  description: string | null
  price: number
  active: boolean
  featured: boolean
  category?: string | null
  weight_g?: number | null
  height_cm?: number | null
  width_cm?: number | null
  length_cm?: number | null
  photo_limit?: number | null
  feat_lyrics_sync?: boolean | null
  feat_qrcode?: boolean | null
  feat_download?: boolean | null
  feat_revision?: boolean | null
}

// Identificador único do plano. Vira a chave primária (products.id) e aparece
// em orders.productId — por isso só é escolhido na criação e nunca muda depois:
// alterar quebraria o vínculo de todo pedido já vendido naquele plano.
function slugify(s: string) {
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export default function ProductForm({ product }: { product?: Product }) {
  const novo = !product

  const [open, setOpen] = useState(false)
  const [id, setId] = useState(product?.id ?? "")
  const [idTocado, setIdTocado] = useState(false)
  const [name, setName] = useState(product?.name ?? "")
  const [description, setDescription] = useState(product?.description ?? "")
  const [price, setPrice] = useState(product ? String(product.price) : "")
  // Plano novo nasce inativo: você cadastra, confere os recursos e só então
  // coloca à venda. Evita plano meio configurado aparecendo na loja.
  const [active, setActive] = useState(product?.active ?? false)
  const [featured, setFeatured] = useState(product?.featured ?? false)
  const [category, setCategory] = useState<"DIGITAL" | "DIGITAL_PHYSICAL">(
    product?.category === "DIGITAL_PHYSICAL" ? "DIGITAL_PHYSICAL" : "DIGITAL"
  )
  const [weightG, setWeightG]     = useState(String(product?.weight_g ?? ""))
  const [heightCm, setHeightCm]   = useState(String(product?.height_cm ?? ""))
  const [widthCm, setWidthCm]     = useState(String(product?.width_cm ?? ""))
  const [lengthCm, setLengthCm]   = useState(String(product?.length_cm ?? ""))

  // Fotos não têm booleano próprio: quem manda é o limite (0 = plano sem
  // fotos). O checkbox é só a forma confortável de zerar/restaurar o número,
  // sem criar uma segunda fonte de verdade que possa divergir do limite.
  const limiteInicial = product?.photo_limit ?? 10
  const [temFotos, setTemFotos]     = useState(limiteInicial > 0)
  const [photoLimit, setPhotoLimit] = useState(String(limiteInicial > 0 ? limiteInicial : 10))

  const [featLyricsSync, setFeatLyricsSync] = useState(product?.feat_lyrics_sync ?? true)
  const [featQrcode, setFeatQrcode]         = useState(product?.feat_qrcode ?? true)
  const [featDownload, setFeatDownload]     = useState(product?.feat_download ?? true)
  const [featRevision, setFeatRevision]     = useState(product?.feat_revision ?? true)

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

  // Enquanto o admin não mexer no identificador, ele acompanha o nome — mas
  // continua editável, porque "Presente Premium" vira um slug longo demais.
  function trocarNome(v: string) {
    setName(v)
    if (novo && !idTocado) setId(slugify(v))
  }

  const handleDelete = async () => {
    if (!product) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/produtos/${product.id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setFeedback({ ok: false, msg: data.error ?? "Erro ao excluir." })
        setConfirmDelete(false)
      } else {
        window.location.reload()
      }
    } catch {
      setFeedback({ ok: false, msg: "Falha de conexão." })
      setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setFeedback(null)
    try {
      const payload = {
        name,
        description,
        price: Number(price),
        active,
        featured,
        category,
        photo_limit: temFotos ? Number(photoLimit || 10) : 0,
        feat_lyrics_sync: featLyricsSync,
        feat_qrcode: featQrcode,
        feat_download: featDownload,
        feat_revision: featRevision,
        ...(category === "DIGITAL_PHYSICAL" ? {
          weight_g:  weightG  ? Number(weightG)  : null,
          height_cm: heightCm ? Number(heightCm) : null,
          width_cm:  widthCm  ? Number(widthCm)  : null,
          length_cm: lengthCm ? Number(lengthCm) : null,
        } : {}),
      }

      const res = novo
        ? await fetch("/api/admin/produtos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, ...payload }),
          })
        : await fetch(`/api/admin/produtos/${product!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })

      const data = await res.json()
      if (!res.ok || !data.success) {
        setFeedback({ ok: false, msg: data.error ?? "Erro ao salvar." })
      } else {
        setFeedback({ ok: true, msg: novo ? "Plano criado!" : "Salvo com sucesso!" })
        setTimeout(() => window.location.reload(), 800)
      }
    } catch {
      setFeedback({ ok: false, msg: "Falha de conexão." })
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return novo ? (
      <button
        onClick={() => setOpen(true)}
        className="text-sm font-semibold text-pink-300 border border-pink-500/40 hover:bg-pink-500/10 px-4 py-2 rounded-xl transition-all"
      >
        + Novo plano
      </button>
    ) : (
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-gray-500 hover:text-white border border-white/10 hover:border-white/30 px-4 py-2 rounded-xl transition-all shrink-0"
      >
        Editar
      </button>
    )
  }

  return (
    <div className={`w-full space-y-3 ${novo
      ? "border border-pink-500/30 bg-pink-500/[0.04] rounded-2xl p-5"
      : "mt-4 border-t border-white/10 pt-4"}`}>
      {novo && <p className="text-sm font-semibold text-pink-200">Novo plano</p>}

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Nome</label>
          <input
            value={name}
            onChange={(e) => trocarNome(e.target.value)}
            placeholder={novo ? "ex: Presente Premium" : undefined}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-pink-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Preço (R$)</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={novo ? "ex: 89.90" : undefined}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-pink-500"
          />
        </div>
      </div>

      {novo ? (
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Identificador único</label>
          <input
            value={id}
            onChange={(e) => { setIdTocado(true); setId(slugify(e.target.value)) }}
            placeholder="ex: plano-presente-premium"
            className="w-full md:w-80 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm font-mono outline-none focus:border-pink-500"
          />
          <p className="text-[11px] text-gray-600 mt-1">
            Fica gravado em todo pedido deste plano e <strong className="text-gray-400">não pode mudar depois</strong>.
          </p>
        </div>
      ) : (
        <p className="text-[11px] text-gray-600">
          Identificador: <span className="font-mono text-gray-400">{product!.id}</span>
        </p>
      )}

      {/* ── Recursos do plano ── */}
      <div className="border border-white/10 rounded-xl p-4 space-y-3 bg-white/[0.03]">
        <div>
          <p className="text-xs text-gray-400 font-medium">🎛️ Recursos do plano</p>
          <p className="text-[11px] text-gray-600 mt-0.5">
            Define o que o cliente recebe. O que estiver desmarcado some da área dele e do player.
            Música, capa e a segunda versão entram em todos os planos e não são parametrizáveis.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input type="checkbox" checked={temFotos} onChange={(e) => setTemFotos(e.target.checked)} className="accent-pink-500" />
          Inserção de fotos (retrospectiva)
        </label>
        {temFotos && (
          <div className="pl-6">
            <label className="text-xs text-gray-500 mb-1 block">Quantas fotos</label>
            <input
              type="number" min="1"
              value={photoLimit}
              onChange={(e) => setPhotoLimit(e.target.value)}
              className="w-32 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-pink-500"
            />
            <p className="text-[11px] text-gray-600 mt-1">A capa gerada pela IA não conta neste limite.</p>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input type="checkbox" checked={featLyricsSync} onChange={(e) => setFeatLyricsSync(e.target.checked)} className="accent-pink-500" />
          Letra sincronizada no player
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input type="checkbox" checked={featQrcode} onChange={(e) => setFeatQrcode(e.target.checked)} className="accent-pink-500" />
          QR Code do presente
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input type="checkbox" checked={featDownload} onChange={(e) => setFeatDownload(e.target.checked)} className="accent-pink-500" />
          Download do MP3
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input type="checkbox" checked={featRevision} onChange={(e) => setFeatRevision(e.target.checked)} className="accent-pink-500" />
          Revisão inclusa (ajustes)
        </label>
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">Categoria do produto</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as "DIGITAL" | "DIGITAL_PHYSICAL")}
          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-pink-500"
        >
          <option value="DIGITAL">Produto digital</option>
          <option value="DIGITAL_PHYSICAL">Produto digital e físico</option>
        </select>
      </div>
      {category === "DIGITAL_PHYSICAL" && (
        <div className="border border-white/10 rounded-xl p-4 space-y-3 bg-white/3">
          <p className="text-xs text-gray-400 font-medium">📦 Dimensões físicas (para cálculo de frete)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Peso (g)</label>
              <input
                type="number" min="1" value={weightG}
                onChange={(e) => setWeightG(e.target.value)}
                placeholder="ex: 500"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-pink-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Altura (cm)</label>
              <input
                type="number" min="1" value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                placeholder="ex: 10"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-pink-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Largura (cm)</label>
              <input
                type="number" min="1" value={widthCm}
                onChange={(e) => setWidthCm(e.target.value)}
                placeholder="ex: 15"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-pink-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Comprimento (cm)</label>
              <input
                type="number" min="1" value={lengthCm}
                onChange={(e) => setLengthCm(e.target.value)}
                placeholder="ex: 20"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-pink-500"
              />
            </div>
          </div>
        </div>
      )}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Descrição</label>
        <p className="text-[11px] text-gray-600 mb-1.5">Aparece como texto corrido dentro de "detalhes" na loja — os chips do card vêm dos checkboxes de recursos acima, não deste texto. Use <span className="text-pink-400 font-mono">{"{fotos}"}</span> para inserir o limite de fotos deste produto — atualiza sozinho, sem editar o texto. Ex.: <span className="text-gray-500">Música exclusiva + {"{fotos}"} fotos + Player 50 dias</span></p>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-pink-500 resize-none"
        />
      </div>
      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-pink-500" />
          Ativo
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="accent-pink-500" />
          Destaque
        </label>
      </div>
      {feedback && (
        <p className={`text-xs px-1 ${feedback.ok ? "text-green-400" : "text-red-400"}`}>
          {feedback.ok ? "✅ " : "❌ "}{feedback.msg}
        </p>
      )}
      <div className="flex gap-3 justify-between items-center">
        {/* Excluir — só faz sentido em plano que já existe */}
        {novo ? <div /> : !confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-xs text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/50 px-3 py-2 rounded-xl transition-all"
          >
            🗑 Excluir
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-400">Tem certeza?</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg font-semibold transition-all"
            >
              {deleting ? "Excluindo…" : "Confirmar"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-gray-500 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 transition-all"
            >
              Cancelar
            </button>
          </div>
        )}

        {/* Salvar / Cancelar */}
        <div className="flex gap-3">
          <button onClick={() => { setOpen(false); setConfirmDelete(false) }} className="text-sm text-gray-500 hover:text-white px-4 py-2 rounded-xl border border-white/10 transition-all">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (novo && (!id || !name || !price))}
            className="text-sm bg-pink-500 hover:bg-pink-600 disabled:opacity-40 px-5 py-2 rounded-xl font-semibold transition-all"
          >
            {saving ? "Salvando…" : novo ? "Criar plano" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  )
}
