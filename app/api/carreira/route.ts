import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@/lib/supabase"
import { carreiraDoUsuario, listarNiveis } from "@/lib/fidelidade"

export const dynamic = "force-dynamic"

async function getUserFromAuth(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null
  if (!token) return null
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data, error } = await anon.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

// Estado da carreira do cliente. Nível, saldo e progresso são calculados no
// SERVIDOR de propósito — a spec é explícita: "benefício é calculado no
// backend, o frontend nunca decide se o cliente ganhou algo". A tela só
// desenha o que vem daqui.
export async function GET(req: NextRequest) {
  const user = await getUserFromAuth(req)
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const supabase = createServerClient()
  const carreira = await carreiraDoUsuario(supabase, user.id)
  if (!carreira) return NextResponse.json({ error: "Programa indisponível." }, { status: 503 })

  const { data: perfil } = await supabase
    .from("profiles").select("personagem").eq("user_id", user.id).maybeSingle()

  // Histórico visível: a spec pede que o cliente veja de onde veio cada disco.
  const { data: extrato } = await supabase
    .from("loyalty_transactions")
    .select("tipo, discos, descricao, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20)

  const niveis = await listarNiveis(supabase)

  return NextResponse.json({
    discos: carreira.discos,
    nivel: carreira.nivel,
    proximo: carreira.proximo,
    faltam: carreira.faltam,
    progresso: carreira.progresso,
    personagem: (perfil?.personagem as string | null) ?? null,
    // A trilha 🚿→❤️→🎤→🎶→⭐ da tela, pra mostrar onde ele está na jornada.
    trilha: niveis.map((n) => ({ id: n.id, icone: n.icone, nome: n.nome, minDiscos: n.minDiscos })),
    extrato: (extrato ?? []).map((t) => ({
      tipo: t.tipo, discos: t.discos, descricao: t.descricao, data: t.created_at,
    })),
  })
}
