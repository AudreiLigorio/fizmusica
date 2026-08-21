-- Indicar amigos — Modelo B (link único por conta, não convite endereçado).
--
-- Funil de 3 etapas da spec de fidelidade ([[project_fizmusica_fidelidade_discos]]):
-- compartilhamento → acesso → conversão. Só a conversão pontua no futuro
-- programa de discos — aqui só construímos o rastreio, sem moeda ainda.
--
-- Decisão de design: conversão NÃO é gravada por um evento — é derivada ao
-- vivo (orders.referral_code + paymentStatus = 'PAID'). A confirmação de
-- pagamento tem 6 pontos de entrada diferentes no código (webhook, confirm,
-- create, admin sync, admin reconcile, cupom 100%) sem um choke point único
-- — gravar a conversão via hook exigiria tocar em todos os 6 (risco alto em
-- código de pagamento). Uma contagem via JOIN evita esse risco por completo.

create table if not exists referral_codes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users(id) on delete cascade,
  code       text not null unique,
  created_at timestamptz not null default now()
);

-- Compartilhamento (clicou no botão) e acesso (alguém abriu o link) — os
-- dois eventos "leves" do funil, gravados aqui. Conversão fica de fora de
-- propósito (ver nota acima).
create table if not exists referral_events (
  id         uuid primary key default gen_random_uuid(),
  code       text not null,
  type       text not null check (type in ('share', 'access')),
  created_at timestamptz not null default now()
);

create index if not exists referral_events_code_idx on referral_events (code);

alter table orders add column if not exists referral_code text;
create index if not exists orders_referral_code_idx on orders (referral_code) where referral_code is not null;

alter table referral_codes enable row level security;
alter table referral_events enable row level security;

drop policy if exists "service_role all referral_codes" on referral_codes;
create policy "service_role all referral_codes"
  on referral_codes for all
  to service_role
  using (true) with check (true);

drop policy if exists "service_role all referral_events" on referral_events;
create policy "service_role all referral_events"
  on referral_events for all
  to service_role
  using (true) with check (true);
