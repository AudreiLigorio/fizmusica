-- ============================================================
-- MIGRATION 064 — Destaque por aplauso: "Em alta" e "Mais aplaudidas"
-- ============================================================
--
-- Duas prateleiras, duas regras — elas estavam disputando o mesmo lugar:
--
--   EM ALTA        palmas POR OUVINTE, janela de 30 dias.
--                  Proporção, não total: de quem ouviu, quanto se emocionou.
--                  Conserta três injustiças de uma vez — música nova não
--                  perde pra velha (a janela zera pra todo mundo), música
--                  muito exibida não ganha por exposição (o ouvinte entra no
--                  divisor), e ninguém precisa de volume pra aparecer.
--
--   MAIS APLAUDIDAS  total acumulado, sem janela. Aqui a antiga ganhar é
--                  JUSTO: ela acumulou porque emocionou mais gente ao longo
--                  do tempo.
--
-- Piso de ouvintes distintos: sem ele, música ouvida por UMA pessoa que deu
-- 10 palmas fica com "10,0 por ouvinte" e lidera pra sempre. Começa em 3 —
-- hoje são 238 reproduções pra 104 músicas (2,3 por música), então quase
-- nada se qualifica, e isso é o certo: prateleira vazia é melhor que pódio
-- decidido por duas pessoas.
--
-- `profiles.interno` tira as contas da casa do destaque sem tirá-las da
-- Rede: as músicas continuam tocando e sendo aplaudidas, só não competem.
-- Sem isso o pódio é espelho nosso — uma conta sozinha tem 51 das 104.

alter table public.profiles
  add column if not exists interno boolean not null default false;

comment on column public.profiles.interno is
  'Conta da casa: fica fora dos destaques da Rede, mas as músicas seguem publicadas.';

-- As três contas com apelido hoje são de casa. Se alguma virar cliente de
-- verdade, é um update — não há nada irreversível aqui.
update public.profiles set interno = true
 where user_id in (
   'fdf8e399-bc45-419f-8884-58b880e44e51',
   'eb7004c3-19bf-4531-93fb-d546c6d4a3df',
   '7039394e-faf7-43de-b517-4a231028c60b'
 );

create or replace function public.destaque_aplauso(
  p_dias int default 30,
  p_piso int default 3
)
returns table (
  "orderId"       text,
  palmas_janela   bigint,
  ouvintes_janela bigint,
  por_ouvinte     numeric,
  palmas_total    bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with interno as (
    select user_id from public.profiles where interno
  ),
  -- Ouvinte é sessão distinta, não reprodução: repetir a faixa não multiplica
  -- o divisor (nem o ranking).
  ouvintes as (
    select mp."orderId", count(distinct coalesce(mp.sessao, mp.id::text)) as n
      from public.music_plays mp
     where mp.created_at > now() - make_interval(days => p_dias)
     group by mp."orderId"
  ),
  palmas as (
    select a."orderId",
           sum(a.palmas) filter (where a.updated_at > now() - make_interval(days => p_dias))::bigint as janela,
           sum(a.palmas)::bigint as total
      from public.music_applause a
      join public.orders o on o.id = a."orderId"
      -- Aplauso do próprio dono não conta: elogiar a si mesmo não é sinal.
     where (o."userId" is null or o."userId" <> a.user_id)
     group by a."orderId"
  )
  select p."orderId",
         coalesce(p.janela, 0),
         coalesce(ou.n, 0),
         round(coalesce(p.janela, 0)::numeric / nullif(ou.n, 0), 2),
         coalesce(p.total, 0)
    from palmas p
    join public.orders o on o.id = p."orderId"
    left join ouvintes ou on ou."orderId" = p."orderId"
   where o.publication_consent = true
     and o.status = 'DELIVERED'
     and (o."userId" is null or o."userId" not in (select user_id from interno))
     and coalesce(ou.n, 0) >= p_piso
   order by 4 desc nulls last, 2 desc;
$$;
