-- ============================================================
-- MIGRATION 010 — Alertas de pagamento (ex.: possível duplicidade)
-- Registrado quando chega um pagamento aprovado com mpPaymentId
-- diferente do já existente num pedido já pago.
-- ============================================================

create table if not exists payment_alerts (
  id                   uuid primary key default gen_random_uuid(),
  "orderId"            text not null,
  type                 text not null default 'DUPLICATE_PAYMENT',
  "mpPaymentId"        text,
  "previousMpPaymentId" text,
  amount               numeric,
  message              text,
  resolved             boolean not null default false,
  created_at           timestamptz not null default now()
);

create index if not exists payment_alerts_order_idx on payment_alerts ("orderId");
create index if not exists payment_alerts_created_idx on payment_alerts (created_at desc);

alter table payment_alerts enable row level security;

drop policy if exists "service_role all payment_alerts" on payment_alerts;
create policy "service_role all payment_alerts"
  on payment_alerts for all
  to service_role
  using (true) with check (true);
