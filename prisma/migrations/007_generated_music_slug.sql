-- ============================================================
-- MIGRATION 007 — Slug público em generated_music
-- ============================================================

alter table generated_music
  add column if not exists slug text unique;

-- Índice para busca rápida por slug
create index if not exists idx_generated_music_slug on generated_music(slug);
