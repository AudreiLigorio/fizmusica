-- ============================================================
-- MIGRATION 009 — Efeito de transição das fotos no player
-- Escolhido no admin (produção). Valores: slide | fade | cards | coverflow
-- ============================================================

alter table orders
  add column if not exists "photo_effect" text not null default 'slide';
