import { createServerClient } from "@/lib/supabase"
import { DEFAULT_COMPOSER_PROMPT } from "./defaultPrompt"

export type SunoMode = "auto" | "review" | "manual"

export type ComposerSettings = {
  prompt: string
  model: string
  location: string
  sunoModel: string
  sunoMode: SunoMode
  revisionAutoAccept: boolean
  // Tetos da prévia da letra no wizard. Ver 043_previa_letra.sql pro porquê dos
  // números — em resumo: o de sessão é regra de produto, o de IP é rede contra
  // script e precisa ficar folgado por causa do CGNAT das operadoras móveis.
  previewMaxSession: number
  previewMaxIpDay: number
}

// Configuração do compositor. Lê a linha única de composer_settings; se não
// existir/estiver vazia, cai no prompt padrão (seed em código) e nos defaults.
export async function getComposerSettings(): Promise<ComposerSettings> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from("composer_settings")
    // `*` de propósito: nomear as colunas faria o select inteiro falhar quando
    // uma delas ainda não existe (migration não aplicada, rollback), e o
    // fallback silencioso trocaria o prompt do admin pelo padrão do código —
    // mudando a letra de todo cliente pagante sem ninguém perceber. Com `*` o
    // que falta simplesmente vem indefinido e cai no `??` de cada campo.
    .select("*")
    .eq("id", 1)
    .maybeSingle()

  const mode = (data?.suno_mode as SunoMode) || "review"
  return {
    prompt:    data?.prompt?.trim()    || DEFAULT_COMPOSER_PROMPT,
    model:     data?.model?.trim()     || process.env.COMPOSER_MODEL || "gemini-flash-latest",
    location:  data?.location?.trim()  || process.env.GCP_LOCATION   || "global",
    sunoModel: data?.sunoModel?.trim() || process.env.SUNO_MODEL     || "V5",
    sunoMode:  ["auto", "review", "manual"].includes(mode) ? mode : "review",
    revisionAutoAccept: data?.revision_auto_accept ?? false,
    previewMaxSession: data?.preview_max_session ?? 2,
    previewMaxIpDay:   data?.preview_max_ip_day   ?? 30,
  }
}
