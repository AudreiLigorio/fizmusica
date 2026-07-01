-- ============================================================
-- MIGRATION 014 — Letra com IA
-- Rascunho da letra editável pelo cliente (pós-pagamento) +
-- configuração do compositor (prompt editável no admin).
-- ============================================================

-- Etapa "Sua letra" na área do cliente
alter table orders add column if not exists "lyricsDraft"          text;
alter table orders add column if not exists "lyricsApproved"       boolean not null default false;
alter table orders add column if not exists "lyricsApprovedAt"     timestamptz;
alter table orders add column if not exists "lyricsReprocessCount" int not null default 0;

-- Configuração do compositor (linha única, editável no /admin)
create table if not exists composer_settings (
  id          int primary key default 1,
  prompt      text not null,
  model       text not null default 'gemini-flash-latest',
  location    text not null default 'global',
  "updatedAt" timestamptz not null default now(),
  constraint composer_settings_singleton check (id = 1)
);
