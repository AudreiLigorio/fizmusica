import { createServerClient } from "@/lib/supabase"

type Campos = {
  context: string | null
  subcategory: string | null
  musicalStyle: string | null
  voiceType: string | null
  emotion: string | null
  honoreeName?: string | null
}

type Resposta = { question: string; answer: string }

// Formatador único do bloco de contexto. Existe pra que o contexto da prévia
// (montado da sessão do wizard, antes do pedido existir) saia BYTE A BYTE igual
// ao do pedido pago — o rascunho da prévia é reaproveitado como letra inicial,
// então qualquer diferença aqui faria a pessoa receber uma música diferente da
// que a fez comprar.
//
// O `.filter(l => l !== "")` no fim é o que remove a linha em branco antes de
// "RESPOSTAS DO CLIENTE". É comportamento antigo e todas as letras já entregues
// foram geradas assim — mantido de propósito.
function formatarContexto(c: Campos, respostas: Resposta[]): string {
  return [
    `OCASIÃO: ${c.context}${c.subcategory ? ` — ${c.subcategory}` : ""}`,
    c.honoreeName ? `HOMENAGEADO(A): ${c.honoreeName}` : "",
    `ESTILO MUSICAL: ${c.musicalStyle}`,
    `TIPO DE VOZ: ${c.voiceType}`,
    `EMOÇÃO: ${c.emotion}`,
    "",
    "RESPOSTAS DO CLIENTE:",
    ...respostas.map((a) => `- ${a.question}\n  ${a.answer}`),
  ]
    .filter((l) => l !== "")
    .join("\n")
}

// Monta o bloco de contexto que vai junto do prompt do compositor: ocasião,
// preferências musicais e todas as perguntas/respostas do wizard daquele pedido.
export async function buildOrderContext(orderId: string): Promise<string | null> {
  const supabase = createServerClient()

  const { data: order } = await supabase
    .from("orders")
    .select("nome, context, subcategory, musicalStyle, voiceType, emotion, honoreeName")
    .eq("id", orderId)
    .single()

  if (!order) return null

  const { data: answers } = await supabase
    .from("order_answers")
    .select("question, answer, position")
    .eq("orderId", orderId)
    .order("position", { ascending: true })

  return formatarContexto(order, (answers ?? []).map((a) => ({ question: a.question, answer: a.answer })))
}

export type SessionWizardData = {
  selectedContext?: string
  selectedSubcategory?: string
  answers?: Record<string, string>
  musicalStyle?: string
  voiceType?: string
  emotion?: string
  honoreeName?: string
}

// Mesma coisa, porém a partir da sessão do wizard — usado pela prévia da letra,
// que roda antes de o pedido existir no banco.
//
// A parte delicada é a ORDEM das respostas. No pedido elas vêm de order_answers
// ordenadas por `position`; na sessão são um objeto indexado pelo texto da
// pergunta. Pra reproduzir a mesma ordem eu releio as perguntas da subcategoria,
// que é de onde o wizard tirou a sequência original.
//
// O filtro é por ocasião E subcategoria: só o label da subcategoria não serve,
// porque ele se repete entre ocasiões — "Aniversário de Namoro" existe tanto em
// "Datas comemorativas" quanto em "Amor & Relacionamentos".
export async function buildSessionContext(data: SessionWizardData): Promise<string | null> {
  if (!data?.selectedContext || !data?.answers) return null

  const supabase = createServerClient()
  const respostas = data.answers

  let ordem: string[] = []

  const { data: ocasioes } = await supabase
    .from("wizard_occasions")
    .select(`label, wizard_subcategories ( label, wizard_questions ( label, sort_order ) )`)
    .eq("label", data.selectedContext)

  const sub = (ocasioes ?? [])
    .flatMap((o: any) => o.wizard_subcategories ?? [])
    .find((s: any) => s.label === data.selectedSubcategory)

  if (sub) {
    ordem = (sub.wizard_questions ?? [])
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((q: any) => q.label)
  }

  // Sem catálogo (subcategoria renomeada ou removida no meio da sessão) não dá
  // pra saber a ordem das perguntas: `wizard_sessions.data` é jsonb e o Postgres
  // reordena as chaves por tamanho, então `Object.keys` devolveria as perguntas
  // embaralhadas — contexto diferente, letra diferente. Melhor não gerar prévia:
  // a tela cai no estado calmo e a letra sai depois do pagamento, do pedido,
  // onde a ordem está guardada em `position`.
  if (!ordem.length) return null

  return formatarContexto(
    {
      context: data.selectedContext,
      subcategory: data.selectedSubcategory ?? null,
      musicalStyle: data.musicalStyle ?? null,
      voiceType: data.voiceType ?? null,
      emotion: data.emotion ?? null,
      // `.trim()` porque é o que o handleFinalizar grava no pedido — sem isso um
      // espaço sobrando no nome já muda a assinatura e faz regerar à toa.
      honoreeName: data.honoreeName?.trim() || null,
    },
    // Todas as perguntas, mesmo sem resposta: o pedido também grava as vazias,
    // e o contexto precisa sair igual ao dele.
    ordem.map((q) => ({ question: q, answer: respostas[q] ?? "" }))
  )
}
