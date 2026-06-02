-- ============================================================
-- MIGRATION 006 — Campos extras na tabela orders
-- ============================================================

-- Opção de prazo de entrega escolhida pelo cliente
alter table orders
  add column if not exists "deliveryOptionId" uuid references product_delivery_options(id);

-- Nome do homenageado (capturado no wizard)
alter table orders
  add column if not exists "honoreeName" text;
