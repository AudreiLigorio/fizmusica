import { randomUUID } from "crypto"
import { createServerClient } from "@/lib/supabase"

// Exclusão de conta pelo próprio cliente — exigência da Play Store (dentro do
// app E por link na web) e direito do titular na LGPD.
//
// O que SOME: o login e tudo que só existe por causa dele — favoritos,
// playlists, perfil (apelido, foto), datas especiais, código de indicação e o
// extrato de discos da Carreira. Essas tabelas têm `on delete cascade` para
// auth.users, então saem sozinhas quando o usuário é apagado.
//
// O que FICA, e por quê:
//  - Pedidos pagos, MP3 e letra: são da Licença (cláusulas 6 e 9 — o mesmo
//    motivo pelo qual o expurgo nunca apaga música paga) e o registro de
//    pagamento é obrigação fiscal. O pedido só perde o vínculo com a conta.
//  - Palmas na Rede: a música pertence a outra pessoa, e apagar as palmas
//    tiraria dela um aplauso que ela recebeu. O autor das palmas vira um id
//    aleatório sem ligação com ninguém — a contagem fica, a pessoa some.
//
// Como os pedidos entram na conta pelo e-mail, se a pessoa criar conta de novo
// com o mesmo e-mail, os pedidos pagos voltam a aparecer. É o comportamento
// certo: a música é dela.

export type ResultadoExclusao =
  | { ok: true }
  | { ok: false; motivo: "pedido_em_andamento"; pedidos: string[] }
  | { ok: false; motivo: "erro"; detalhe: string }

// Pedido pago com a música ainda sendo feita. Excluir a conta no meio deixaria
// uma música sem ninguém para aprovar a letra, escolher a versão ou receber.
export async function pedidosEmAndamento(userId: string, email: string | null): Promise<string[]> {
  const supabase = createServerClient()
  const filtro = email ? `userId.eq.${userId},email.eq.${email.toLowerCase()}` : `userId.eq.${userId}`
  const { data } = await supabase
    .from("orders")
    .select("id, honoreeName")
    .eq("status", "IN_PRODUCTION")
    .or(filtro)
  // Set: dois pedidos para a mesma pessoa não precisam aparecer duas vezes.
  return [...new Set((data ?? []).map((o) => (o.honoreeName ? `Música para ${o.honoreeName}` : `Pedido ${String(o.id).slice(0, 8)}`)))]
}

export async function excluirConta(userId: string, email: string | null): Promise<ResultadoExclusao> {
  const pendentes = await pedidosEmAndamento(userId, email)
  if (pendentes.length) return { ok: false, motivo: "pedido_em_andamento", pedidos: pendentes }

  const supabase = createServerClient()
  try {
    // Foto de perfil mora no storage — o cascade do banco não chega lá.
    const { data: perfil } = await supabase.from("profiles").select("avatar_path").eq("user_id", userId).maybeSingle()
    if (perfil?.avatar_path) await supabase.storage.from("avatars").remove([perfil.avatar_path])

    // Tabelas que apontam para o usuário SEM foreign key (não cascateiam).
    // Tudo antes de apagar o login: se algo falhar, a pessoa ainda consegue
    // entrar e tentar de novo, em vez de sobrar dado órfão sem dono.
    const passos = await Promise.all([
      supabase.from("music_applause").update({ user_id: randomUUID() }).eq("user_id", userId),
      supabase.from("orders").update({ userId: null }).eq("userId", userId),
      supabase.from("order_claims").delete().eq("userId", userId),
      supabase.from("customers").update({ user_id: null }).eq("user_id", userId),
    ])
    const falha = passos.find((p) => p.error)
    if (falha?.error) return { ok: false, motivo: "erro", detalhe: falha.error.message }

    const { error } = await supabase.auth.admin.deleteUser(userId)
    if (error) return { ok: false, motivo: "erro", detalhe: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, motivo: "erro", detalhe: e instanceof Error ? e.message : String(e) }
  }
}
