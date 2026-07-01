-- 015_enable_rls.sql
-- Segurança: habilita Row-Level Security (RLS) em TODAS as tabelas do schema public.
--
-- Contexto: o alerta do Supabase ("Table publicly accessible / rls_disabled_in_public")
-- aponta que, com RLS desligado, qualquer um com a anon key (exposta no bundle JS do
-- site) pode ler/editar/apagar dados direto pela API REST do Supabase.
--
-- Por que isso é seguro para o app: todo acesso a DADOS é feito server-side via
-- service_role (createServerClient), que IGNORA RLS. O anon client no browser só faz
-- autenticação (supabase.auth.*), que não depende de RLS nestas tabelas. Portanto,
-- habilitar RLS SEM criar policies = nega 100% do acesso anon/authenticated às tabelas,
-- sem quebrar nada do app.
--
-- Idempotente: pode rodar mais de uma vez sem efeito colateral.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
  END LOOP;
END $$;
