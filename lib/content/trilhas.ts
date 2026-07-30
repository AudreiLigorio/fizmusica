import { temaFromTexto } from "@/lib/content/temas"

// Estilo musical por ocasião.
//
// Existe porque "estilo da música" digitado à mão sempre acabava no mesmo lugar
// ("pop acústico emotivo") — e a mesma trilha melosa que serve para homenagem a
// pai atrapalha um chá revelação, onde a emoção é expectativa e alegria, não
// nostalgia. A ocasião é o que define a trilha, não o gosto de quem digita.

export type Trilha = { tema: string; estilo: string }

const POR_TEMA: Record<string, Trilha> = {
  mae: {
    tema: "gratidão de filho para mãe, memórias de cuidado e colo",
    estilo: "MPB acústica intimista, voz feminina suave, piano e violão dedilhado, andamento lento",
  },
  pai: {
    tema: "reconhecimento do esforço silencioso de um pai",
    estilo: "MPB acústica com violão de nylon, voz masculina calorosa, cordas discretas, andamento médio",
  },
  casamento: {
    tema: "amor que atravessou o tempo e virou promessa",
    estilo: "balada romântica com piano e cordas, voz limpa, crescendo emocional no refrão",
  },
  revelacao: {
    tema: "expectativa e alegria pela chegada de um bebê",
    estilo: "pop acústico luminoso e ascendente, palmas suaves, glockenspiel, andamento animado",
  },
  pet: {
    tema: "companhia fiel e saudade de um amigo de quatro patas",
    estilo: "folk delicado, guitarra limpa e piano, sem bateria, tom terno e contido",
  },
  homenagem: {
    tema: "reconhecimento público de alguém que fez diferença",
    estilo: "pop orquestral inspirador, cordas e piano, crescendo grandioso no refrão",
  },
}

const PADRAO: Trilha = {
  tema: "história real transformada em canção",
  estilo: "pop acústico emotivo, violão e piano, cordas suaves",
}

/** Trilha sugerida a partir do tema/ocasião da peça. */
export function trilhaParaTexto(texto: string | null | undefined): Trilha {
  const slug = temaFromTexto(texto)
  return (slug && POR_TEMA[slug]) || PADRAO
}

/** Tabela pra injetar no prompt do roteirista — ele escolhe, não inventa. */
export function tabelaDeEstilos(): string {
  return (
    "Estilos musicais por ocasião (use o que corresponder à ocasião da peça; a trilha de homenagem " +
    "a pai NÃO serve para chá revelação, onde a emoção é expectativa e não nostalgia):\n" +
    Object.entries(POR_TEMA)
      .map(([slug, t]) => `- ${slug}: ${t.estilo}`)
      .join("\n")
  )
}
