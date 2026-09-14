-- ============================================================
-- MIGRATION 061 — Aplauso da Rede (medidor de volume)
-- ============================================================
--
-- Quem ouve arrasta um medidor e dá de 1 a 10 PALMAS. Não é nota: metade
-- do acervo é luto (despedida de pet, homenagem a quem morreu), e média
-- pública viraria veredito sobre a memória de alguém — com o volume de
-- hoje, UM voto definiria essa média. Aplauso é só positivo: quem gostou
-- pouco aplaude pouco, e nenhuma música exibe nota baixa.
--
-- Uma linha por pessoa+música, e ela SÓ AUMENTA (ver aplaudir()). Combina
-- com aplauso e limita o estrago de um toque sem querer.
--
-- `on delete cascade` é OBRIGATÓRIO: tabela que referencia orders sem ele
-- trava o expurgo LGPD — já aconteceu com `payments` e segurou 48
-- cadastros por 3 semanas.
--
-- orders.id é TEXT (não uuid), apesar do que a migração 001 sugere.

create table if not exists public.music_applause (
  id         bigserial primary key,
  "orderId"  text not null references public.orders(id) on delete cascade,
  user_id    uuid not null,
  palmas     smallint not null check (palmas between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique ("orderId", user_id)
);

create index if not exists music_applause_order_idx
  on public.music_applause ("orderId");

-- A cota diária é somada por pessoa no dia — este índice é o que a torna
-- barata.
create index if not exists music_applause_user_dia_idx
  on public.music_applause (user_id, updated_at desc);

alter table public.music_applause enable row level security;

-- Sem policy de propósito: todo acesso passa pelo servidor com a service
-- role, que não é barrada por RLS. Cliente nenhum lê ou escreve direto.

-- Registra ou AUMENTA o aplauso, respeitando a cota do dia.
--
-- A cota existe porque, sem escassez, todo mundo arrasta até o fim e o
-- medidor vira ruído em uma semana — é o colapso das 5 estrelas. Ela conta
-- o que foi GASTO hoje: numa segunda aplaudida da mesma música, só a
-- diferença sai da cota, senão aumentar de 3 para 5 custaria 5.
--
-- Devolve o total da música, o que esta pessoa já deu e o que sobra do dia.
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
   where a.user_id = p_user_id
     and a.updated_at >= date_trunc('day', now());

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

-- Agregado de todas as músicas de uma vez, pro destaque da Rede.
--
-- `ouvintes` é quem APLAUDIU, não quem ouviu — o ranking é palmas por
-- ouvinte justamente pra música antiga não ganhar só por tempo no ar.
-- O aplauso do DONO não entra: elogiar a própria música não é sinal.
create or replace function public.contagem_aplausos()
returns table ("orderId" text, total bigint, ouvintes bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    a."orderId",
    sum(a.palmas)::bigint,
    count(*)::bigint
  from public.music_applause a
  join public.orders o on o.id = a."orderId"
  where o."userId" is null or o."userId" <> a.user_id
  group by a."orderId";
$$;
