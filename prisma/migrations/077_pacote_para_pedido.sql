-- 077 — vínculo do pacote com o pedido de música que o motivou
--
-- Quem está no funil (/produtos) com um pedido de música em aberto pode
-- comprar o pacote ali mesmo. Quando o pagamento do pacote confirma, 1 dos 10
-- créditos tem que pagar ESSE pedido na hora — senão a pessoa compra o pacote
-- "para esta música" e a música fica parada, não paga, sem o e-mail de
-- aprovar a letra.
--
-- O vínculo vive no BANCO e não na URL de propósito: quem paga PIX e fecha a
-- aba não volta para lugar nenhum, e um débito preso ao cliente se perderia
-- justamente nesse caso. É o mesmo motivo pelo qual ensurePaymentPrep existe.
--
-- `on delete set null`, nunca sem cláusula: FK para `orders` sem isso já
-- travou o expurgo LGPD por três semanas (048/payments). Apagar a música
-- deixa o pedido de pacote de pé, só sem a referência.
--
-- `text` porque `orders.id` é TEXT neste banco, apesar do que a migração 001
-- sugere.

alter table orders
  add column if not exists pacote_para_pedido text
  references orders(id) on delete set null;

comment on column orders.pacote_para_pedido is
  'Pedido de música que motivou a compra deste pacote. Ao creditar o pacote, 1 crédito paga esse pedido automaticamente. Só preenchido quando a compra parte do funil.';

create index if not exists idx_orders_pacote_para_pedido
  on orders (pacote_para_pedido)
  where pacote_para_pedido is not null;
