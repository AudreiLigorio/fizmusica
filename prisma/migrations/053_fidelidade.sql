-- ============================================================
-- 053 — Fidelidade "Minha Carreira": níveis + histórico de discos
-- ============================================================
-- Spec de 2026-08-19. Duas regras da spec moldam este schema:
--
-- 1) "Regras e faixas configuráveis no admin, não no código" — por isso
--    loyalty_levels é tabela, não constante. Nome, faixa e desconto mudam
--    sem deploy.
-- 2) "Histórico imutável — correção administrativa é transação nova, nunca
--    edição/apagamento" — por isso loyalty_transactions só recebe insert.
--    O saldo é a SOMA das transações, nunca um contador que alguém edita.

-- ── Níveis ──────────────────────────────────────────────────
-- min_discos é o piso da faixa; o teto é o piso do próximo (aberto no último).
create table if not exists loyalty_levels (
  id             smallint primary key,
  nome           text    not null,
  icone          text    not null,
  min_discos     integer not null,
  desconto_digital smallint not null default 0,
  desconto_fisico  smallint not null default 0,
  ativo          boolean not null default true,
  -- Arte do personagem por nível; o arquivo real é
  -- public/carreira/nivel-{id}-{m,f}.webp. Guardado como prefixo pra o admin
  -- poder trocar a arte sem mexer em código.
  arte_prefixo   text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Faixas iniciais da spec (0–2 / 3–5 / 6–9 / 10–19 / 20+) e os descontos
-- digitais 0/10/15/20/25. Físico começa zerado de propósito: a spec pede
-- tabela separada porque a margem é outra, e o Audrei ainda não definiu.
insert into loyalty_levels (id, nome, icone, min_discos, desconto_digital, desconto_fisico, arte_prefixo) values
  (1, 'Cantor de Chuveiro', '🚿',  0,  0, 0, 'nivel-1'),
  (2, 'Cantor da Família',  '❤️',  3, 10, 0, 'nivel-2'),
  (3, 'Cantor de Eventos',  '🎤',  6, 15, 0, 'nivel-3'),
  (4, 'Cantor de Shows',    '🎶', 10, 20, 0, 'nivel-4'),
  (5, 'Popstar',            '⭐', 20, 25, 0, 'nivel-5')
on conflict (id) do nothing;

-- ── Histórico (append-only) ─────────────────────────────────
create table if not exists loyalty_transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- text, não uuid: orders.id é TEXT no banco real, apesar de a migração 001
  -- declarar uuid e os valores parecerem uuid. As migrações .sql deste repo
  -- divergem do banco em vários pontos — conferir sempre antes de referenciar.
  order_id    text references orders(id) on delete set null,
  tipo        text not null check (tipo in (
                'PURCHASE_DIGITAL',   -- +1
                'PURCHASE_PHYSICAL',  -- +2
                'REFERRAL_CONVERTED', -- +2
                'REFUND',             -- negativo
                'ADMIN_ADJUST'        -- correção manual, sempre transação nova
              )),
  discos      integer not null,
  descricao   text,
  created_at  timestamptz not null default now()
);

-- Um pedido concede disco UMA vez por tipo. É esta trava que deixa a função de
-- concessão ser idempotente: a confirmação de pagamento tem seis pontos de
-- entrada no projeto (webhook, confirm, create, sync e reconcile do admin,
-- cupom 100%), então ela vai ser chamada repetido — e precisa ser inofensivo.
-- Estorno e ajuste ficam de fora: podem repetir pro mesmo pedido.
create unique index if not exists loyalty_tx_pedido_unico
  on loyalty_transactions (order_id, tipo)
  where order_id is not null and tipo in ('PURCHASE_DIGITAL','PURCHASE_PHYSICAL','REFERRAL_CONVERTED');

create index if not exists loyalty_tx_user_idx on loyalty_transactions (user_id, created_at desc);

alter table loyalty_levels enable row level security;
alter table loyalty_transactions enable row level security;

-- Todo acesso passa pelas rotas de API (service_role), igual às outras tabelas
-- novas do projeto. O saldo NUNCA é calculado no navegador: a spec exige que o
-- benefício seja decidido no backend.
drop policy if exists "loyalty_levels service_role" on loyalty_levels;
create policy "loyalty_levels service_role" on loyalty_levels
  for all to service_role using (true) with check (true);

drop policy if exists "loyalty_tx service_role" on loyalty_transactions;
create policy "loyalty_tx service_role" on loyalty_transactions
  for all to service_role using (true) with check (true);
