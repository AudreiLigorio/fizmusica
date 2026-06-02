-- ============================================================
-- MIGRATION 005 — Seed de product_delivery_options
-- ============================================================

insert into product_delivery_options (product_id, label, days, price_extra, sort_order, active)
values
  -- Música Digital
  ('prod-digital', 'Normal (5 dias úteis)',   5, 0.00,  1, true),
  ('prod-digital', 'Expresso (3 dias úteis)', 3, 30.00, 2, true),
  ('prod-digital', 'Urgente (1 dia útil)',    1, 70.00, 3, true),

  -- Box Premium
  ('prod-premium', 'Normal (7 dias úteis)',   7, 0.00,  1, true),
  ('prod-premium', 'Expresso (5 dias úteis)', 5, 30.00, 2, true),
  ('prod-premium', 'Urgente (3 dias úteis)',  3, 70.00, 3, true),

  -- QR Code Musical
  ('prod-qrcode', 'Normal (5 dias úteis)',   5, 0.00,  1, true),
  ('prod-qrcode', 'Expresso (3 dias úteis)', 3, 30.00, 2, true),
  ('prod-qrcode', 'Urgente (1 dia útil)',    1, 70.00, 3, true),

  -- Spotify Frame
  ('prod-spotify', 'Normal (5 dias úteis)',   5, 0.00,  1, true),
  ('prod-spotify', 'Expresso (3 dias úteis)', 3, 30.00, 2, true),
  ('prod-spotify', 'Urgente (1 dia útil)',    1, 70.00, 3, true)

on conflict do nothing;
