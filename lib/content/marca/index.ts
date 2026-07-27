import fs from "fs"
import path from "path"

// Base de conhecimento da marca — a "camada de inteligência compartilhada" que
// todo agente de conteúdo consulta antes de escrever. Mora em markdown
// versionado (e não no banco) de propósito: muda junto com o código, aparece
// no diff do PR e pode ser revisada por pessoa. Mesmo padrão de leitura dos
// documentos legais (`app/legal/[slug]`), que já roda em produção na Vercel.

export type MarcaDoc = "voz" | "personas" | "ganchos" | "redes" | "qualidade"

const FILES: Record<MarcaDoc, string> = {
  voz: "00-voz-e-tom.md",
  personas: "01-personas.md",
  ganchos: "02-ganchos.md",
  redes: "03-redes.md",
  qualidade: "04-qualidade.md",
}

const cache = new Map<MarcaDoc, string>()

function readDoc(doc: MarcaDoc): string {
  const cached = cache.get(doc)
  if (cached) return cached
  const file = path.join(process.cwd(), "lib/content/marca", FILES[doc])
  const content = fs.readFileSync(file, "utf-8")
  cache.set(doc, content)
  return content
}

// Concatena os documentos pedidos num bloco único pra injetar no system prompt.
// Pedir só o que o agente precisa mantém o prompt enxuto — o revisor crítico,
// por exemplo, não precisa das regras de rede.
export function loadMarca(docs: MarcaDoc[]): string {
  return docs.map(readDoc).join("\n\n---\n\n")
}
