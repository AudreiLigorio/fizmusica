-- Trava de idempotência do crédito.
--
-- Três rotas marcam um pedido como PAID — webhook do Mercado Pago, retorno
-- do checkout (/confirm) e pagamento zerado (/free) — e todas chamam
-- `ensurePaymentPrep`. Quem paga no cartão passa por DUAS delas: o webhook
-- chega e o navegador volta pelo /confirm. Sem esta trava, o pacote de 10
-- creditaria 20.
--
-- É a mesma defesa que `loyalty_transactions` já usa para os discos: índice
-- único, e a rechamada bate no 23505 em vez de duplicar. Idempotência no
-- BANCO, não no código, porque as duas rotas podem rodar ao mesmo tempo e
-- um "já creditou?" em TypeScript tem janela entre a leitura e a escrita.
--
-- Parcial de propósito:
--   'pacote'  — um pedido de pacote credita UMA vez
--   'consumo' — um pedido de música gasta UMA vez (rede extra sobre o
--               advisory lock da 072: aquele impede a corrida, este impede
--               a rechamada)
--   'estorno' e 'ajuste_admin' ficam de fora: correção manual legitimamente
--               se repete, e é sempre transação nova.
create unique index if not exists credit_transactions_pedido_unico
  on credit_transactions (order_id, origem)
  where origem in ('pacote', 'consumo');
