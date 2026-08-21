-- Minhas músicas & playlists.
--
-- "Minhas músicas" NÃO é uma tabela nova — é derivado dos pedidos entregues
-- da própria conta (mesma fonte que já alimenta /minha-musica). Só
-- "playlist" (agrupamento que o cliente cria) precisa de armazenamento novo.
--
-- track_order_ids como array em vez de tabela de junção: a lista inteira é
-- reescrita a cada drag-and-drop (adicionar/reordenar), não há necessidade
-- de uma linha por item — um update simples já resolve.

create table if not exists playlists (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  nome            text not null,
  track_order_ids uuid[] not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists playlists_user_idx on playlists (user_id);

alter table playlists enable row level security;

drop policy if exists "service_role all playlists" on playlists;
create policy "service_role all playlists"
  on playlists for all
  to service_role
  using (true) with check (true);
