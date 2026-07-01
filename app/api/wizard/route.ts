import { NextResponse } from "next/server"
import { getWizardOccasions } from "@/lib/wizard"

export async function GET() {
  try {
    const occasions = await getWizardOccasions()
    return NextResponse.json({ occasions })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
