export const dynamic = "force-dynamic"

import { createServerClient } from "@/lib/supabase"
import ProductForm from "./ProductForm"
import DeliveryOptions from "./DeliveryOptions"

async function getProducts() {
  const supabase = createServerClient()
  const { data } = await supabase
    .from("products")
    .select("*")
    .order("sortOrder", { ascending: true })
  return data ?? []
}

export default async function AdminProdutos() {
  const products = await getProducts()

  return (
    <div className="p-4 lg:p-8 max-w-4xl">
      <h1 className="text-2xl lg:text-3xl font-bold mb-1">Produtos</h1>
      <p className="text-gray-500 text-sm mb-6 lg:mb-10">Gerencie os produtos disponíveis para compra</p>

      <div className="space-y-4">
        {products.map((p) => (
          <div
            key={p.id}
            className="bg-black/40 border border-white/10 rounded-2xl p-6"
          >
            <div className="flex items-start gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="font-semibold text-lg">{p.name}</h2>
                  {p.featured && (
                    <span className="bg-pink-500/15 text-pink-300 border border-pink-500/20 text-xs px-2 py-0.5 rounded-full">
                      Destaque
                    </span>
                  )}
                  {!p.active && (
                    <span className="bg-gray-500/15 text-gray-400 text-xs px-2 py-0.5 rounded-full">
                      Inativo
                    </span>
                  )}
                </div>
                <p className="text-gray-400 text-sm mb-3">{p.description}</p>
                <p className="text-pink-400 font-bold text-xl">
                  R$ {Number(p.price).toFixed(2).replace(".", ",")}
                </p>
              </div>
              <ProductForm product={p} />
            </div>
            {p.category !== "DIGITAL_PHYSICAL" ? (
              <DeliveryOptions productId={p.id} />
            ) : (
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-xs text-gray-500">
                  📦 Produto físico — o cliente preencherá os dados de envio (nome, CEP, endereço, etc.) ao selecionar este produto. Prazos de entrega não se aplicam.
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
