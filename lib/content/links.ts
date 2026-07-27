import crypto from "crypto"
import type { createServerClient } from "@/lib/supabase"
import { temaFromTexto } from "@/lib/content/temas"

type DB = ReturnType<typeof createServerClient>

// Link rastreado de um rascunho: /r/<slug> registra o clique e redireciona pra
// landing do tema com UTM. É a única forma de saber se post virou visita —
// antes disso, "conversão" era achismo.

// Slug curto e legível o suficiente pra ser digitado se preciso. 7 caracteres
// de base32 sem vogais (evita formar palavra) dão ~34 bilhões de combinações.
const ALFABETO = "23456789bcdfghjkmnpqrstvwxyz"

function novoSlug(): string {
  const bytes = crypto.randomBytes(7)
  return Array.from(bytes)
    .map((b) => ALFABETO[b % ALFABETO.length])
    .join("")
}

export function buildDestination(tema: string | null, platform: string, slug: string): string {
  const base = tema ? `/tema/${tema}` : "/criar"
  const params = new URLSearchParams({
    utm_source: platform,
    utm_medium: "organico",
    utm_campaign: tema ?? "geral",
    utm_content: slug,
  })
  return `${base}?${params.toString()}`
}

// Cria (ou reaproveita) o link do rascunho. Silencioso por design: se falhar,
// o rascunho continua válido — rastreio não pode derrubar publicação.
export async function ensureDraftLink(
  supabase: DB,
  draftId: string,
  platform: string,
  textoDoTema: string | null,
): Promise<string | null> {
  try {
    const { data: existente } = await supabase
      .from("content_links")
      .select("slug")
      .eq("draft_id", draftId)
      .maybeSingle()
    if (existente?.slug) return existente.slug

    const slug = novoSlug()
    const tema = temaFromTexto(textoDoTema)
    const destination = buildDestination(tema, platform, slug)

    const { error } = await supabase
      .from("content_links")
      .insert({ slug, draft_id: draftId, tema, platform, destination })
    if (error) throw new Error(error.message)

    await supabase.from("content_drafts").update({ link_slug: slug }).eq("id", draftId)
    return slug
  } catch (e) {
    console.error("[content] falha ao criar link rastreado:", e instanceof Error ? e.message : e)
    return null
  }
}
