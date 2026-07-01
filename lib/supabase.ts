import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Cliente para uso no browser (componentes client-side)
export const supabase = createClient(url, anonKey)

// Cliente server-side com service_role (ignora RLS)
// Usado apenas em Server Components e API Routes
export function createServerClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Sem a service_role, o fallback para anon NÃO funciona mais: com RLS habilitado
  // em todas as tabelas (migration 015), a anon key não lê/escreve nada e as telas
  // viriam vazias silenciosamente. Falhar explícito é mais seguro que esconder o bug.
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurada — acesso server-side ao banco indisponível (RLS bloqueia a anon key)."
    )
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  })
}
