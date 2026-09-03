-- ============================================================
-- MIGRATION 057 — Reproduções por música (Top 10 da Rede)
-- ============================================================
--
-- Por que uma tabela nova, e não reusar generated_music.views:
-- `views` conta a ABERTURA da página pública /m/{slug}, o link que o
-- cliente compartilha. Não é "ouvida", não distingue quem só abriu de
-- quem escutou, e não enxerga nada do que acontece dentro da Rede Fiz
-- Música. Ranking de "mais ouvidas" em cima dela mentiria.
--
-- Append-only, no mesmo espírito de order_events.
--
-- `on delete cascade` é OBRIGATÓRIO: tabela que referencia orders sem ele
-- trava o expurgo LGPD — já aconteceu com `payments` e segurou 48
-- cadastros por 3 semanas.
--
-- orders.id é TEXT (não uuid), apesar do que a migração 001 sugere.

create table if not exists public.music_plays (
  id         bigserial primary key,
  "orderId"  text not null references public.orders(id) on delete cascade,
  sessao     text,
  created_at timestamptz not null default now()
);

create index if not exists music_plays_order_idx
  on public.music_plays ("orderId");

-- Índice para a janela do ranking (mais ouvidas dos últimos 30 dias).
create index if not exists music_plays_recentes_idx
  on public.music_plays (created_at desc);

-- Índice da deduplicação por sessão (ver registrar_play).
create index if not exists music_plays_sessao_idx
  on public.music_plays ("orderId", sessao, created_at desc);

alter table public.music_plays enable row level security;

-- Sem policy de propósito: todo acesso passa pelo servidor com a service
-- role, que não é barrada por RLS. Cliente nenhum lê ou escreve direto.

-- Registra uma reprodução, ignorando repetição da mesma sessão dentro de
-- 30 min. Não impede fraude determinada (a sessão é só um id de
-- localStorage); impede o ruído honesto, que é o que sujaria o ranking:
-- repetir a faixa, arrastar a barra, recarregar a página.
--
-- A janela é checada AQUI e não por índice único: `date_trunc` sobre
-- timestamptz é STABLE, não IMMUTABLE, e o Postgres recusa função assim
-- em expressão de índice.
create or replace function public.registrar_play(p_order_id text, p_sessao text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_sessao is not null and exists (
    select 1 from public.music_plays
    where "orderId" = p_order_id
      and sessao = p_sessao
      and created_at > now() - interval '30 minutes'
  ) then
    return;
  end if;

  insert into public.music_plays ("orderId", sessao)
  values (p_order_id, p_sessao);
end;
$$;

-- Contagem agregada de todas as músicas de uma vez.
-- Existe porque a alternativa seria uma consulta por música na montagem
-- do catálogo — 68 hoje, e cresce junto com ele.
create or replace function public.contagem_plays()
returns table ("orderId" text, total bigint, recentes bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    mp."orderId",
    count(*)::bigint as total,
    count(*) filter (where mp.created_at > now() - interval '30 days')::bigint as recentes
  from public.music_plays mp
  group by mp."orderId";
$$;
