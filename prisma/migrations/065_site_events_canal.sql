-- ============================================================
-- MIGRATION 065 — Canal do evento: app ou web
-- ============================================================
--
-- O app Android (TWA) é o próprio site aberto em tela cheia, então sem esta
-- coluna não haveria como separar o que acontece no app do que acontece no
-- navegador — e o plano é justamente decidir a migração pro Flutter olhando
-- retenção, reproduções e compras PELO APP (docs/app-android.md).
--
-- Diferente de utm_*/referrer (primeiro toque, gravados uma vez), o canal é
-- de cada evento: a mesma pessoa pode ter chegado pelo Instagram e hoje abrir
-- pelo app.
--
-- Nula nos eventos antigos (anteriores ao app) — ler como "web".

alter table site_events add column if not exists canal text;
