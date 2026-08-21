-- Datas especiais — lembretes recorrentes de datas importantes do cliente
-- (aniversário, casamento, avós, pet...). Ligada à CONTA (auth.uid()), não ao
-- pedido: não depende do backfill de orders.userId (nulo na maior parte dos
-- pedidos hoje), porque quem chega em /minha-musica já está autenticado.
--
-- Fase 1: guardar e listar. O lembrete automático (~15-20 dias antes) fica
-- pra uma fase 2, à parte.

create table if not exists special_dates (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  nome          text not null,
  ocasiao_emoji text not null,
  ocasiao_label text not null,
  data          date not null,
  created_at    timestamptz not null default now()
);

create index if not exists special_dates_user_idx on special_dates (user_id);

alter table special_dates enable row level security;

drop policy if exists "service_role all special_dates" on special_dates;
create policy "service_role all special_dates"
  on special_dates for all
  to service_role
  using (true) with check (true);
