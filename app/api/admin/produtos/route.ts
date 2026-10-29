import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { createServerClient } from "@/lib/supabase"
import { verifyAdminToken, COOKIE_NAME } from "@/lib/admin-auth"
import { criarProdutoSchema } from "@/lib/validators/produto"

// O proxy só cobre /admin/* — rota de API precisa conferir o cookie por conta
// própria, senão qualquer um cria plano (e preço) no catálogo.
async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  return token ? verifyAdminToken(token) : false
}

const schema = criarProdutoSchema

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  try {
    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const supabase = createServerClient()

    // Identificador é imutável depois de criado (pedidos apontam pra ele), então
    // reaproveitar um id existente sobrescreveria o plano de pedidos já vendidos.
    const { data: existente } = await supabase
      .from("products").select("id").eq("id", parsed.data.id).maybeSingle()
    if (existente) {
      return NextResponse.json(
        { error: `Já existe um plano com o identificador "${parsed.data.id}".` },
        { status: 409 },
      )
    }

    // Entra no fim da vitrine; a ordem fina se ajusta depois arrastando/editando.
    const { data: ultimo } = await supabase
      .from("products").select("sortOrder").order("sortOrder", { ascending: false }).limit(1).maybeSingle()

    // createdAt/updatedAt são NOT NULL sem default no banco (herança do Prisma,
    // que preenche do lado da aplicação) — sem isto o insert é recusado.
    const agora = new Date().toISOString()
    const { error } = await supabase.from("products").insert({
      ...parsed.data,
      // A coluna tem `default true` no banco: sem forçar aqui, um plano criado
      // sem o campo entraria direto na vitrine, meio configurado. Nasce
      // inativo e vai à venda quando o admin marcar "Ativo".
      active: parsed.data.active ?? false,
      sortOrder: (ultimo?.sortOrder ?? 0) + 1,
      createdAt: agora,
      updatedAt: agora,
    })
    // O erro do Supabase é um objeto simples, não um Error — `err.message` num
    // catch genérico devolveria "Erro desconhecido" e esconderia a causa real.
    if (error) {
      return NextResponse.json({ error: error.message ?? "Erro ao criar o plano." }, { status: 500 })
    }

    revalidatePath("/admin/produtos")
    return NextResponse.json({ success: true, id: parsed.data.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
