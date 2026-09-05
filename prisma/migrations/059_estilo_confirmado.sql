-- ============================================================
-- MIGRATION 059 — Estilo sonoro confirmado pelo cliente
-- ============================================================
--
-- Hoje o estilo que vai pro Suno é EFÊMERO: buildSunoStyle roda no disparo
-- da geração, usa e esquece. O cliente nunca vê e não pode corrigir.
--
-- Com o card "Como sua música vai soar", ele passa a ver e editar. Aí o
-- valor precisa durar, por um motivo prático: no "gerar novamente" e na
-- revisão, tem que ser reusado o que ELE aprovou. Extraindo de novo, a
-- segunda versão sairia com um estilo diferente do que ele confirmou — e
-- ele leria isso como defeito, não como variação.
--
-- Nulo = ninguém confirmou nada; o disparo cai no comportamento antigo
-- (extrai na hora). Assim os pedidos que já existem seguem funcionando.

alter table public.orders
  add column if not exists "style_confirmed" text;

comment on column public.orders."style_confirmed" is
  'Tags de estilo aprovadas pelo cliente no card "Como sua música vai soar". Quando preenchido, tem precedência sobre a extração automática no disparo da geração.';
