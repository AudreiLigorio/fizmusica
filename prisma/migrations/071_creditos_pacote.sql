-- Saldo de créditos: o pacote pré-pago ("10 músicas por R$ 49,90").
--
-- POR QUE NÃO É SÓ UM PRODUTO NOVO: cada campo de `products` descreve UMA
-- música (photo_limit, feat_qrcode, feat_revision), e o fluxo é 1 produto →
-- 1 pedido → 1 música. Um produto "pacote" geraria um pedido só.
--
-- POR QUE NÃO É CUPOM: a tabela `coupons` quase serve (type percent, value
-- 100, max_uses 10), mas não tem dono nem produto — o código vazaria para o
-- grupo da família e valeria numa Premium de R$ 99,90. Decisão do Audrei em
-- 29/10/2026: saldo de verdade.
--
-- RAZÃO (ledger), NÃO CONTADOR, como `order_events` e `loyalty_transactions`:
-- saldo é a soma dos deltas. Contador que decrementa não tem história quando
-- dá errado, e aqui "dá errado" significa alguém pagou e não recebeu.

create table if not exists credit_transactions (
  id          uuid primary key default gen_random_uuid(),
  -- O saldo vive no USUÁRIO. É isto que torna o crédito intransferível: não é
  -- regra que alguém precisa lembrar de validar, é o modelo de dados.
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- text, não uuid: `orders.id` é TEXT no banco real (ver 053_fidelidade).
  --
  -- `on delete cascade` de propósito. Tabela que referencia `orders` sem
  -- cascade TRAVA o expurgo da LGPD — já aconteceu com `payments` e parou 48
  -- cadastros por três semanas. O extrato de crédito não é documento fiscal;
  -- o pagamento é, e aquele tem a própria retenção.
  order_id    text references orders(id) on delete cascade,
  -- Positivo credita, negativo gasta. Nunca zero.
  delta       integer not null check (delta <> 0),
  origem      text not null check (origem in (
                'pacote',       -- comprou um pacote (+)
                'consumo',      -- gastou numa música (-)
                'estorno',      -- devolução proporcional do não usado (+/-)
                'ajuste_admin'  -- correção manual, sempre transação nova
              )),
  descricao   text,
  created_at  timestamptz not null default now()
);

create index if not exists credit_transactions_user_idx
  on credit_transactions (user_id, created_at desc);

-- Dois papéis distintos, e um produto pode ter os dois zerados (a maioria tem).
--
-- `credits_granted` > 0  → comprar este produto DÁ créditos: é um pacote.
-- `credit_price`  não nulo → este produto PODE ser comprado com crédito.
--
-- É aqui que mora a exigência do Audrei de o crédito não valer em qualquer
-- coisa: a música avulsa recebe `credit_price = 1`; Retrospectiva e Premium
-- ficam nulos e o crédito simplesmente não é oferecido neles.
alter table products add column if not exists credits_granted integer not null default 0;
alter table products add column if not exists credit_price    integer;

alter table products add constraint products_credits_granted_nao_negativo
  check (credits_granted >= 0) not valid;
alter table products add constraint products_credit_price_positivo
  check (credit_price is null or credit_price > 0) not valid;

-- Débito ATÔMICO. Sem isto, duas abas abertas gastam o mesmo crédito duas
-- vezes: ler o saldo e inserir o -1 em dois passos deixa uma janela entre os
-- dois. Aqui o insert só acontece se a soma travada já for suficiente, numa
-- instrução só.
--
-- `security definer` + search_path fixo seguem a 068_funcoes_so_servidor.
create or replace function gastar_credito(
  p_user_id uuid,
  p_order_id text,
  p_quantidade integer default 1,
  p_descricao text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saldo integer;
begin
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'quantidade precisa ser positiva';
  end if;

  -- Trava as linhas deste usuário até o fim da transação: qualquer outra
  -- tentativa de gastar espera aqui em vez de ler um saldo que vai mudar.
  select coalesce(sum(delta), 0) into v_saldo
    from credit_transactions
   where user_id = p_user_id
     for update;

  if v_saldo < p_quantidade then
    return false;
  end if;

  insert into credit_transactions (user_id, order_id, delta, origem, descricao)
  values (p_user_id, p_order_id, -p_quantidade, 'consumo', p_descricao);

  return true;
end;
$$;

revoke all on function gastar_credito(uuid, text, integer, text) from public, anon, authenticated;

alter table credit_transactions enable row level security;

comment on table credit_transactions is
  'Razão de créditos do pacote pré-pago. Saldo = soma de delta por user_id. Append-only: correção é transação nova, nunca UPDATE.';
