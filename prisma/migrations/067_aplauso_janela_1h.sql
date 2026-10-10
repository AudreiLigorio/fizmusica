-- ============================================================
-- MIGRATION 067 — Aplauso ajustável só na primeira hora
-- ============================================================
--
-- Decisão do Audrei (2026-10-09): na primeira hora depois de aplaudir, a
-- pessoa ajusta à vontade — pra MAIS ou pra MENOS (de 1 a 10). Passada a
-- hora, o aplauso fica fixo. Substitui a regra "só aumenta, pra sempre" da
-- 063, que travava quem errou o arrasto e não deixava corrigir.
--
-- Por que fixar: o ranking das mais aplaudidas da Rede (destaque, Top) é
-- feito com a soma das palmas. Aplauso mexível pra sempre deixaria o ranking
-- instável e manipulável (tirar o aplauso de uma música depois de uma briga,
-- subir e descer conforme a semana).
--
-- A janela conta do PRIMEIRO aplauso (created_at, que o upsert não mexe) —
-- ajustar dentro da hora não renova o prazo, senão bastaria mexer a cada 59
-- minutos pra nunca travar.
--
-- O retorno muda (`resta` da cota antiga sai, entra `editavel_ate`), então
-- as funções são recriadas. Único consumidor: app/api/rede/aplauso.

drop function if exists public.aplaudir(text, uuid, smallint, smallint);
drop function if exists public.aplauso_estado(text, uuid, smallint);

create function public.aplaudir(
  p_order_id text,
  p_user_id  uuid,
  p_palmas   smallint
)
returns table (total bigint, minhas smallint, editavel_ate timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_atual   smallint;
  v_criado  timestamptz;
begin
  if p_palmas < 1 or p_palmas > 10 then
    raise exception 'palmas fora da faixa';
  end if;

  select a.palmas, a.created_at into v_atual, v_criado
    from public.music_applause a
   where a."orderId" = p_order_id and a.user_id = p_user_id;

  if v_atual is null then
    insert into public.music_applause ("orderId", user_id, palmas)
    values (p_order_id, p_user_id, p_palmas)
    returning created_at into v_criado;
    v_atual := p_palmas;
  elsif now() <= v_criado + interval '1 hour' then
    update public.music_applause
       set palmas = p_palmas, updated_at = now()
     where "orderId" = p_order_id and user_id = p_user_id;
    v_atual := p_palmas;
  end if;
  -- Fora da janela: não muda nada; quem chamou compara `editavel_ate` com
  -- agora e explica à pessoa.

  return query
    select coalesce((select sum(a.palmas) from public.music_applause a where a."orderId" = p_order_id), 0)::bigint,
           v_atual,
           v_criado + interval '1 hour';
end;
$$;

create function public.aplauso_estado(
  p_order_id text,
  p_user_id  uuid default null
)
returns table (total bigint, minhas smallint, editavel_ate timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select sum(a.palmas) from public.music_applause a where a."orderId" = p_order_id), 0)::bigint,
    coalesce((select a.palmas from public.music_applause a
               where a."orderId" = p_order_id and a.user_id = p_user_id), 0)::smallint,
    (select a.created_at + interval '1 hour' from public.music_applause a
      where a."orderId" = p_order_id and a.user_id = p_user_id);
$$;

-- Só o servidor chama (service role). As versões antigas, SECURITY DEFINER,
-- ficavam executáveis por anon — dava pra aplaudir em nome de qualquer
-- user_id chamando a função direto pela API do Supabase.
revoke all on function public.aplaudir(text, uuid, smallint) from public, anon, authenticated;
revoke all on function public.aplauso_estado(text, uuid) from public, anon, authenticated;
grant execute on function public.aplaudir(text, uuid, smallint) to service_role;
grant execute on function public.aplauso_estado(text, uuid) to service_role;
