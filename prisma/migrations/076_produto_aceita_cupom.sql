-- "Este produto aceita cupom?" — propriedade DO PRODUTO.
--
-- A 074 deu ao cupom um `product_id` ("vale só neste plano"). Serve para
-- promoção dirigida, mas não resolve o que o Audrei quer: que os cupons
-- valham em tudo MENOS no pacote.
--
-- Expressar isso no cupom exigiria uma lista de exclusão em cada um, e cada
-- cupom novo nasceria com o buraco de novo — alguém teria que lembrar. Uma
-- chave no PRODUTO fecha de uma vez, para os cupons de hoje e para os que
-- ainda não existem.
--
-- Por que o pacote é diferente: ele não é uma música com desconto, é SALDO.
-- Um cupom de 100% ali não dá "uma música grátis" — dá dez, e o valor do
-- desconto passa a depender de onde foi usado.
alter table products add column if not exists aceita_cupom boolean not null default true;

comment on column products.aceita_cupom is
  'Produto aceita desconto por cupom. Falso em pacotes de crédito: cupom ali multiplica o valor do desconto pelo tamanho do pacote.';

-- Fecha os pacotes que já existem. Novos pacotes precisam ser marcados na
-- mão — o padrão é `true` porque a esmagadora maioria dos produtos é música.
update products set aceita_cupom = false where coalesce(credits_granted, 0) > 0;
