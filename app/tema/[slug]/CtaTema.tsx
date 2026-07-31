"use client"

import { useRouter } from "next/navigation"
import { track } from "@/lib/track"

// O CTA da landing precisa ser cliente pra registrar o clique: é ele que
// fecha o elo "veio do post → clicou no link → clicou em criar".
export default function CtaTema({ slug, label }: { slug: string; label: string }) {
  const router = useRouter()
  return (
    <button
      onClick={() => { track("cta_criar", `tema:${slug}`); router.push("/criar") }}
      className="inline-block text-white font-semibold px-6 py-3.5 rounded-full text-base"
      style={{ background: "linear-gradient(135deg, #f0196b, #d946ef)" }}
    >
      {label}
    </button>
  )
}
