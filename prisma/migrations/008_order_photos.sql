-- ============================================================
-- MIGRATION 008 — Fotos do cliente (exibidas no player)
-- Upload pós-pagamento, acesso por token sem login
-- ============================================================

-- Token de acesso à página de upload de fotos (sem login)
alter table orders
  add column if not exists "photo_token" uuid unique;

-- ------------------------------------------------------------
-- Tabela de fotos enviadas pelo cliente
-- ------------------------------------------------------------
create table if not exists order_photos (
  id           uuid primary key default gen_random_uuid(),
  "orderId"    text not null references orders(id) on delete cascade,
  url          text not null,
  storage_path text not null,
  is_cover     boolean not null default false,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists order_photos_order_idx on order_photos ("orderId");

-- ------------------------------------------------------------
-- RLS — mesmo padrão das demais tabelas
-- ------------------------------------------------------------
alter table order_photos enable row level security;

-- Backend (service_role) tem acesso total
drop policy if exists "service_role all order_photos" on order_photos;
create policy "service_role all order_photos"
  on order_photos for all
  to service_role
  using (true) with check (true);

-- Leitura pública (galeria exibida no player)
drop policy if exists "public read order_photos" on order_photos;
create policy "public read order_photos"
  on order_photos for select
  using (true);
