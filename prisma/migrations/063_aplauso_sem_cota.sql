-- ============================================================
-- MIGRATION 063 — Aplauso sem cota diária
-- ============================================================
--
-- A cota existia pra forçar escolha (sem escassez, todo mundo arrasta até o
-- fim). O custo apareceu no primeiro uso real: a pessoa quer aplaudir e
-- topa com uma regra que precisa entender — decisão do Audrei, 2026-09-15:
-- "quanto mais palmas mais destaque, sem limitar nada".
--
-- O que FICA, e não é enfeite: uma aplaudida por pessoa por música, e só
-- aumenta. Sem isso uma pessoa sozinha empurra qualquer música pro topo —
-- e com 3 contas ativas hoje, essa pessoa seria a casa. A unicidade é o que
-- faz o número significar "quanta gente aplaudiu", não "quem insistiu mais".

create or replace function public.aplaudir(
  p_order_id text,
  p_user_id  uuid,
  p_palmas   smallint,
  p_cota_dia smallint default null  -- mantido só pra não quebrar chamada antiga
)
returns table (total bigint, minhas smallint, resta smallint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_atual smallint := 0;
begin
  if p_palmas < 1 or p_palmas > 10 then
    raise exception 'palmas fora da faixa';
  end if;

  select a.palmas into v_atual
    from public.music_applause a
   where a."orderId" = p_order_id and a.user_id = p_user_id;

  v_atual := coalesce(v_atual, 0);

  -- Só aumenta. Pedido menor não é erro: é gesto sem efeito. Aplauso dado
  -- não se recolhe — e isso evita alguém tirar o que deu a uma homenagem
  -- depois de uma briga.
  if p_palmas > v_atual then
    insert into public.music_applause ("orderId", user_id, palmas)
    values (p_order_id, p_user_id, p_palmas)
    on conflict ("orderId", user_id)
    do update set palmas = p_palmas, updated_at = now();
    v_atual := p_palmas;
  end if;

  return query
    select coalesce((select sum(a.palmas) from public.music_applause a where a."orderId" = p_order_id), 0)::bigint,
           v_atual,
           null::smallint;
end;
$$;

create or replace function public.aplauso_estado(
  p_order_id text,
  p_user_id  uuid default null,
  p_cota_dia smallint default null
)
returns table (total bigint, minhas smallint, resta smallint)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select sum(a.palmas) from public.music_applause a where a."orderId" = p_order_id), 0)::bigint,
    coalesce((select a.palmas from public.music_applause a
               where a."orderId" = p_order_id and a.user_id = p_user_id), 0)::smallint,
    null::smallint;
$$;
