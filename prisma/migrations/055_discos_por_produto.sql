-- ============================================================
-- 055 — Discos de fidelidade configuráveis POR PRODUTO
-- ============================================================
-- Achado do Audrei: hoje o Essencial (R$15,90) e a Retrospectiva premium
-- (R$89,90) rendem o MESMO 1 disco — a regra só olhava a categoria
-- (DIGITAL vs DIGITAL_PHYSICAL), nunca o valor do plano. Sem estímulo
-- nenhum pra subir de plano.
--
-- loyalty_discos fica NO PRODUTO (não numa faixa de preço calculada), porque
-- é a mesma decisão de "regra configurável no admin, não no código" que já
-- vale pros níveis (loyalty_levels, migração 053) — o Audrei ajusta o valor
-- de cada plano sem precisar de deploy.
--
-- Backfill preserva o comportamento ATUAL (1 digital / 2 físico) de
-- propósito: a migração não muda distribuição nenhuma sozinha. Os valores
-- por plano (Essencial diferente de Retrospectiva premium) são ajuste
-- comercial do Audrei, feito depois no painel — não uma suposição minha.
alter table products
  add column if not exists loyalty_discos integer not null default 1
  check (loyalty_discos >= 0);

update products
  set loyalty_discos = 2
  where upper(category) like '%PHYSICAL%';
