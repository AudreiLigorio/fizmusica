-- ============================================================
-- MIGRATION 062 — Cota de palmas vira à meia-noite de BRASÍLIA
-- ============================================================
--
-- `date_trunc('day', now())` usa o fuso da sessão, que no Supabase é UTC.
-- Na prática a cota virava às 21h de Brasília: quem aplaudiu às 20h e de
-- novo às 22h ganhava dia novo no meio da noite, e o aviso "voltam amanhã"
-- mentia por três horas. Mesmo bug de fuso que já mordeu este projeto em
-- tela de data (ver lib/date.ts).
--
-- O Brasil não tem mais horário de verão desde 2019, mas `at time zone`
-- resolve isso sozinho se voltar — não há offset fixo escrito aqui.
--
-- Vai junto `aplauso_estado`: a rota calculava o início do dia em
-- JavaScript pra montar o GET, o que era uma SEGUNDA definição de "hoje",
-- livre pra divergir desta. Agora as duas leituras saem do mesmo lugar.

create or replace function public.aplaudir(
  p_order_id text,
  p_user_id  uuid,
  p_palmas   smallint,
  p_cota_dia smallint default 30
)
returns table (total bigint, minhas smallint, resta smallint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_atual smallint := 0;
  v_gasto smallint := 0;
  v_delta smallint;
  v_dia   timestamptz := date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
begin
  if p_palmas < 1 or p_palmas > 10 then
    raise exception 'palmas fora da faixa';
  end if;

  select a.palmas into v_atual
    from public.music_applause a
   where a."orderId" = p_order_id and a.user_id = p_user_id;

  v_atual := coalesce(v_atual, 0);
  -- Só aumenta. Pedido menor não é erro: é gesto sem efeito.
  v_delta := greatest(p_palmas - v_atual, 0);

  select coalesce(sum(a.palmas), 0)::smallint into v_gasto
    from public.music_applause a
   where a.user_id = p_user_id and a.updated_at >= v_dia;

  if v_delta > p_cota_dia - v_gasto then
    v_delta := greatest(p_cota_dia - v_gasto, 0);
  end if;

  if v_delta > 0 then
    insert into public.music_applause ("orderId", user_id, palmas)
    values (p_order_id, p_user_id, (v_atual + v_delta)::smallint)
    on conflict ("orderId", user_id)
    do update set palmas = (v_atual + v_delta)::smallint, updated_at = now();
    v_atual := (v_atual + v_delta)::smallint;
    v_gasto := (v_gasto + v_delta)::smallint;
  end if;

  return query
    select coalesce((select sum(a.palmas) from public.music_applause a where a."orderId" = p_order_id), 0)::bigint,
           v_atual,
           greatest(p_cota_dia - v_gasto, 0)::smallint;
end;
$$;

-- Leitura: total da música, o que esta pessoa deu e o que sobra do dia dela.
-- `p_user_id` nulo é o visitante — ele vê o total (o aplauso é público) e não
-- tem cota, porque dar palma exige conta.
create or replace function public.aplauso_estado(
  p_order_id text,
  p_user_id  uuid default null,
  p_cota_dia smallint default 30
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
    case when p_user_id is null then null::smallint else
      greatest(p_cota_dia - coalesce((
        select sum(a.palmas)::smallint from public.music_applause a
         where a.user_id = p_user_id
           and a.updated_at >= date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'
      ), 0), 0)::smallint
    end;
$$;
