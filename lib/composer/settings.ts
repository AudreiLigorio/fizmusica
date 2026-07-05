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
}

// Configuração do compositor. Lê a linha única de composer_settings; se não
// existir/estiver vazia, cai no prompt padrão (seed em código) e nos defaults.
export async function getComposerSettings(): Promise<ComposerSettings> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from("composer_settings")
    .select("prompt, model, location, sunoModel, suno_mode, revision_auto_accept")
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
  }
}
