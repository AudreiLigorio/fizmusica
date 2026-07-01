-- 017_grandfather_lyrics.sql
-- Correção de dados: o gate da Fila de Produção (Fase 3) passou a exigir
-- lyricsApproved=true. Isso escondeu TODOS os pedidos pagos legados (criados antes
-- da feature "Letra com IA" entrar no ar para os clientes em 2026-06-22), incluindo
-- pedidos em produção e já entregues — eles nunca terão a letra aprovada pelo cliente.
--
-- Solução: "grandfathering" — marca como aprovados todos os pedidos pagos anteriores
-- ao corte, trazendo-os de volta à fila. Pedidos novos (>= corte) seguem o fluxo normal.

UPDATE orders
SET "lyricsApproved" = true,
    "lyricsApprovedAt" = COALESCE("lyricsApprovedAt", "createdAt")
WHERE "paymentStatus" = 'PAID'
  AND status <> 'ABANDONED'
  AND ("lyricsApproved" IS NULL OR "lyricsApproved" = false)
  AND "createdAt" < '2026-06-22T00:00:00Z';
