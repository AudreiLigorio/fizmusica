import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Cliente para uso no browser (componentes client-side)
export const supabase = createClient(url, anonKey)

// Cliente server-side com service_role (ignora RLS)
// Usado apenas em Server Components e API Routes
export function createServerClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceKey) {
    // Fallback para anon key enquanto service_role não está configurada
    return createClient(url, anonKey)
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  })
}
