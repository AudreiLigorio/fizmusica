-- Cupom preso a um produto.
--
-- Sem isto o valor do cupom depende de ONDE ele é usado, e isso não é
-- controlável: um código de 100% pensado para dar UMA música de R$ 9,90
-- zera também o Pacote de R$ 49,90 e entrega DEZ créditos. O caminho existe
-- inteiro — o cupom zera o total, o pedido sai pelo `/api/payments/free`, e
-- o `ensurePaymentPrep` credita o pacote como em qualquer compra.
--
-- Medido em 29/10/2026: os dois cupons de 100% no ar (TESTEAPP e
-- FIZMUSIC30M) estavam ativos e sem limite de usos.
--
-- NULO = vale em qualquer produto, que é como todos os cupons de hoje se
-- comportam. A coluna nasce permissiva de propósito: prender os existentes
-- a um produto de repente invalidaria códigos que já foram distribuídos.
alter table coupons add column if not exists product_id text references products(id) on delete cascade;

comment on column coupons.product_id is
  'Produto em que este cupom vale. NULO = vale em qualquer um.';
