-- ============================================================
-- MIGRATION 012 — Registro de consentimento (prova LGPD)
-- ============================================================

alter table orders
  add column if not exists "terms_accepted_at" timestamptz,
  add column if not exists "terms_version"     text,
  add column if not exists "honoree_consent"   boolean not null default false;
