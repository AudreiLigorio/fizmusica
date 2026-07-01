-- 016_fn_search_path.sql
-- Segurança (Supabase Advisor: "Function Search Path Mutable"): fixa o search_path
-- das funções public para evitar resolução de nomes via objetos maliciosos no schema.
-- Usa search_path vazio + nomes totalmente qualificados (pg_catalog é sempre buscado
-- automaticamente, então now() continua resolvendo).

CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.increment_coupon_use(p_code text)
  RETURNS void
  LANGUAGE sql
  SET search_path = ''
AS $function$
  update public.coupons set used_count = used_count + 1 where lower(code) = lower(p_code);
$function$;

CREATE OR REPLACE FUNCTION public.increment_music_views(p_slug text)
  RETURNS void
  LANGUAGE sql
  SET search_path = ''
AS $function$
  update public.generated_music set views = views + 1 where slug = p_slug;
$function$;
