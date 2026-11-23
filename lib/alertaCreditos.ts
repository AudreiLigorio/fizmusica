import { createServerClient } from "@/lib/supabase"

// ─────────────────────────────────────────────────────────────────────────────
// Créditos de IA: Google (Gemini, escreve as letras) e Suno via KIE (gera as
// músicas). Os dois são pré-pagos — quando zeram, o produto para.
//
// Em 23/11/2026 o crédito do Gemini acabou e TODA prévia de letra falhou por
// horas sem ninguém saber: a tela cai num estado calmo de propósito (não trava
// a venda), então do lado de fora nada parecia quebrado. O Audrei achou
// testando no celular — com anúncio pago rodando.
//
// Três camadas:
//  1. NA HORA: `alertarSeFaltaDeCredito` é chamado onde a geração falha
//     (lib/composer/gemini.ts e lib/suno/client.ts). Só dispara se o erro for
//     de crédito — timeout e instabilidade não viram e-mail de emergência.
//  2. TODO DIA: /api/cron/creditos consulta os dois e só escreve se houver
//     problema (Suno abaixo do limite, Google recusando).
//  3. DIAS 1 E 16: o mesmo cron manda um resumo mesmo com tudo bem.
//
// Todo alerta é "uma vez por dia por motivo" (tabela `alertas_enviados`):
// falha a cada minuto não pode virar 1.440 e-mails.
// ─────────────────────────────────────────────────────────────────────────────

export type Servico = "google" | "suno"

// Abaixo disso o Suno entra em alerta. ~12 créditos por música no V5, então
// 600 ≈ 50 músicas: folga pra recarregar sem parar a produção.
export const SUNO_LIMITE_MIN = Number(process.env.ALERTA_SUNO_MIN ?? 600) || 600

const NOME: Record<Servico, string> = {
  google: "Google (Gemini) — escreve as letras",
  suno: "Suno (KIE) — gera as músicas",
}
const ONDE_RECARREGAR: Record<Servico, { text: string; url: string }> = {
  google: { text: "Abrir o Google AI Studio ↗", url: "https://aistudio.google.com/" },
  suno: { text: "Abrir o painel da KIE ↗", url: "https://kie.ai/" },
}

// Dia no fuso do Brasil: a trava "uma vez por dia" precisa virar à meia-noite
// daqui, não às 21h (meia-noite UTC).
export const diaBrasil = (d = new Date()) => new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 10)

// Erro de CRÉDITO, não de instabilidade. Cuidado com RESOURCE_EXHAUSTED do
// Google: ele também é o 429 de limite por minuto — só conta se falar de
// crédito/pré-pago/cobrança.
export function ehFaltaDeCredito(servico: Servico, erro: unknown): boolean {
  const msg = erro instanceof Error ? erro.message : typeof erro === "string" ? erro : JSON.stringify(erro ?? "")
  if (servico === "google") {
    return /prepay|credits? (are )?depleted|"code":\s*402|billing/i.test(msg)
  }
  return /credit|insufficient|top ?up|balance|saldo/i.test(msg)
}

// Grava a chave; só quem conseguiu inserir manda o e-mail. A chave primária
// resolve a corrida entre duas falhas simultâneas.
async function primeiraVezHoje(chave: string): Promise<boolean> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("alertas_enviados")
    .upsert({ chave }, { onConflict: "chave", ignoreDuplicates: true })
    .select("chave")
  if (error) {
    // Sem a trava, melhor avisar a mais do que deixar de avisar.
    console.error("[alertaCreditos] trava", error.message)
    return true
  }
  return (data?.length ?? 0) > 0
}

async function enviar(...args: Parameters<typeof import("@/app/services/emailService").sendAlertaCreditos>) {
  const { sendAlertaCreditos } = await import("@/app/services/emailService")
  const r = await sendAlertaCreditos(...args)
  if (!r.ok) console.error("[alertaCreditos] e-mail", r.error)
  return r
}

export async function alertarFaltaDeCredito(servico: Servico, motivo: string, opts?: { saldo?: number }) {
  const tipo = opts?.saldo != null ? "saldo-baixo" : "falta-credito"
  if (!(await primeiraVezHoje(`${tipo}:${servico}:${diaBrasil()}`))) return

  const zerou = tipo === "falta-credito"
  await enviar({
    assunto: zerou
      ? `🚨 EMERGÊNCIA FizMusica: falta de crédito no ${servico === "google" ? "Google (letras)" : "Suno (músicas)"}`
      : `⚠️ FizMusica: crédito do Suno acabando (${opts?.saldo} restantes)`,
    emoji: zerou ? "🚨" : "⚠️",
    titulo: zerou ? "Falta de crédito — o site parou de gerar" : "Crédito do Suno acabando",
    subtitulo: NOME[servico],
    paragrafos: zerou
      ? [
          servico === "google"
            ? "As letras não estão sendo geradas: a <strong>prévia da letra</strong> no site cai no aviso calmo e <strong>quem pagar não recebe a letra</strong>."
            : "As músicas não estão sendo geradas: <strong>quem aprovar a letra fica esperando a música</strong>.",
          "Recarregue agora. Se houver anúncio rodando, vale pausar até voltar.",
          "Este aviso sai no máximo uma vez por dia.",
        ]
      : [
          `Restam <strong>${opts?.saldo} créditos</strong> no Suno (limite de alerta: ${SUNO_LIMITE_MIN}, ~${Math.floor((opts?.saldo ?? 0) / 12)} músicas).`,
          "Recarregue antes de zerar para a produção não parar.",
        ],
    linhas: [["Detalhe", `<span style="font-family:monospace;font-size:12px">${motivo.slice(0, 300).replace(/</g, "&lt;")}</span>`]],
    botao: ONDE_RECARREGAR[servico],
  })
}

// Camada 1: chamado no catch de quem gera. Nunca lança — o alerta não pode
// virar um segundo erro em cima do primeiro.
export async function alertarSeFaltaDeCredito(servico: Servico, erro: unknown) {
  try {
    if (!ehFaltaDeCredito(servico, erro)) return
    const msg = erro instanceof Error ? erro.message : String(erro)
    await alertarFaltaDeCredito(servico, msg)
  } catch (e) {
    console.error("[alertaCreditos]", e instanceof Error ? e.message : e)
  }
}

export type EstadoCreditos = {
  google: { ok: boolean; detalhe: string }
  suno: { ok: boolean; saldo: number | null; detalhe: string }
}

// O Google NÃO informa saldo por API. O teste é uma chamada mínima (poucas
// palavras de entrada, 1 de saída, sem "pensar"): custa ~US$ 0,000006 e diz se
// a conta está gerando. Avisa quando ZEROU (ou o cartão da recarga automática
// falhou), não quando está acabando.
async function testarGoogle(): Promise<EstadoCreditos["google"]> {
  try {
    const { getComposerSettings } = await import("@/lib/composer/settings")
    const { GoogleGenAI } = await import("@google/genai")
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return { ok: true, detalhe: "Sem GEMINI_API_KEY (Vertex): teste não se aplica" }
    const settings = await getComposerSettings()
    const ai = new GoogleGenAI({ apiKey })
    await ai.models.generateContent({
      model: settings.model,
      contents: "Responda só: ok",
      config: { maxOutputTokens: 1, thinkingConfig: { thinkingBudget: 0 } },
    })
    return { ok: true, detalhe: "Gerando normalmente" }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // Instabilidade passageira não é falta de crédito: só reprova por crédito.
    if (ehFaltaDeCredito("google", e)) return { ok: false, detalhe: msg }
    return { ok: true, detalhe: `Teste falhou, mas não por crédito: ${msg.slice(0, 160)}` }
  }
}

async function testarSuno(): Promise<EstadoCreditos["suno"]> {
  try {
    const { getCreditBalance } = await import("@/lib/suno/client")
    const saldo = await getCreditBalance()
    return { ok: saldo >= SUNO_LIMITE_MIN, saldo, detalhe: `${saldo} créditos (~${Math.floor(saldo / 12)} músicas)` }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: true, saldo: null, detalhe: `Não consegui consultar: ${msg.slice(0, 160)}` }
  }
}

export async function checarCreditos(): Promise<EstadoCreditos> {
  const [google, suno] = await Promise.all([testarGoogle(), testarSuno()])
  return { google, suno }
}

// Camada 3: resumo quinzenal, mesmo com tudo bem.
export async function enviarResumoCreditos(estado: EstadoCreditos, { forcar = false } = {}) {
  if (!forcar && !(await primeiraVezHoje(`resumo-creditos:${diaBrasil()}`))) return
  const tudoOk = estado.google.ok && estado.suno.ok
  await enviar({
    assunto: `${tudoOk ? "✅" : "⚠️"} FizMusica: resumo dos créditos de IA`,
    emoji: tudoOk ? "✅" : "⚠️",
    titulo: "Resumo dos créditos de IA",
    subtitulo: "Enviado nos dias 1 e 16 de cada mês",
    paragrafos: [
      tudoOk
        ? "Tudo funcionando. Nada a fazer agora."
        : "Tem algo pedindo atenção — veja abaixo.",
      "O Google não informa saldo: o teste só confirma se está gerando. Com a recarga automática ligada, falha aqui costuma ser cartão recusado ou vencido.",
    ],
    linhas: [
      ["Google (letras)", `${estado.google.ok ? "✅" : "🚨"} ${estado.google.detalhe.replace(/</g, "&lt;").slice(0, 200)}`],
      ["Suno (músicas)", `${estado.suno.ok ? "✅" : "⚠️"} ${estado.suno.detalhe.replace(/</g, "&lt;")}`],
      ["Alerta do Suno", `abaixo de ${SUNO_LIMITE_MIN} créditos`],
    ],
  })
}
