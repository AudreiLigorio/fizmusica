-- ============================================================
-- MIGRATION 011 — Vínculo de pedidos a contas + reivindicação
-- Permite ligar um pedido (feito com e-mail A) a uma conta logada
-- com e-mail B, mediante confirmação no e-mail A.
-- ============================================================

alter table orders
  add column if not exists "userId" uuid;

create index if not exists orders_user_idx on orders ("userId");

create table if not exists order_claims (
  id           uuid primary key default gen_random_uuid(),
  "orderId"    text not null references orders(id) on delete cascade,
  "userId"     uuid not null,
  email        text not null,
  token        uuid unique not null default gen_random_uuid(),
  "confirmedAt" timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists order_claims_token_idx on order_claims (token);

alter table order_claims enable row level security;

drop policy if exists "service_role all order_claims" on order_claims;
create policy "service_role all order_claims"
  on order_claims for all
  to service_role
  using (true) with check (true);
