// Abre uma sessão de verdade na conta de teste, sem senha: o admin emite um
// magic link e o navegador entra por ele. Mesma porta que o cliente usa.
import { createServerClient } from "@/lib/supabase"

export async function linkDeEntrada(email: string, destino: string): Promise<string> {
  const s = createServerClient()
  const { data, error } = await (s.auth as any).admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: destino },
  })
  if (error) throw new Error(`não consegui emitir o link: ${error.message}`)
  return data.properties.action_link as string
}
