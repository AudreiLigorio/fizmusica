-- ============================================================
-- MIGRATION 058 — Conteúdo de vitrine da própria Fiz Música
-- ============================================================
--
-- Músicas produzidas pela plataforma para povoar a Rede Fiz Música
-- (decisão do Audrei, 2026-09-04: "pode assinar como Fiz Música").
--
-- Por que um valor NOVO no enum, e não UNPAID:
--   - o expurgo LGPD apaga pedidos `= 'UNPAID'` com mais de 15 dias
--     (lib/purge.ts, duas ocorrências) — a vitrine sumiria sozinha;
--   - faturamento, fidelidade e fila de produção filtram `= 'PAID'`,
--     então um valor próprio já fica fora de todos eles sem precisar
--     alterar consulta nenhuma.
--
-- O catálogo da Rede NÃO filtra por pagamento (só status DELIVERED +
-- publication_consent), então a vitrine aparece normalmente.
--
-- Aditivo: nenhum pedido existente muda de valor.

alter type "PaymentStatus" add value if not exists 'SHOWCASE';
