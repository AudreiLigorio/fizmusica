-- O uso do cupom passa a ser contado por IDENTIDADE, não por texto.
--
-- O defeito: `countCouponUses` conta pedidos cujo `orders.coupon_code` bate
-- com o código. Esse campo é histórico e nunca some. Então, se um cupom for
-- APAGADO (o admin tem o botão Excluir) e outro for criado com o mesmo
-- código, o novo nasce herdando todos os usos do antigo — um "máx. de usos
-- 10" poderia já começar esgotado, sem ninguém entender por quê.
--
-- Levantado pelo Audrei em 29/10/2026: "eu posso não lembrar de um código de
-- cupom antigo". É exatamente o ponto — o risco não depende de ninguém
-- lembrar de nada, e é alcançável pela tela.
--
-- `coupon_code` CONTINUA sendo gravado: é o registro do que foi aplicado
-- naquela compra e vale como histórico mesmo depois de o cupom deixar de
-- existir. O que muda é quem responde "quantas vezes ESTE cupom foi usado".
alter table orders add column if not exists coupon_id uuid references coupons(id) on delete set null;

-- `set null`, nunca cascade: apagar um cupom não pode apagar pedido pago. E
-- o efeito colateral é o desejado — some o vínculo, some a contagem, e um
-- cupom novo com o mesmo código começa do zero.

create index if not exists orders_coupon_id_idx on orders (coupon_id) where coupon_id is not null;

-- Vincula o histórico que já existe, pra os cupons de hoje não perderem a
-- contagem que já tinham. Casa por código sem diferenciar maiúsculas — mesma
-- regra do `ilike` que a contagem usava.
update orders o
   set coupon_id = c.id
  from coupons c
 where o.coupon_id is null
   and o.coupon_code is not null
   and lower(o.coupon_code) = lower(c.code);
