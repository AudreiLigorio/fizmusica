-- Log de eventos do pedido — append-only, nunca sobrescreve. Serve de histórico
-- pra apresentar ao cliente em caso de contestação (o que ele fez e quando).
create table if not exists order_events (
  id         uuid primary key default gen_random_uuid(),
  "orderId"  text not null references orders(id) on delete cascade,
  type       text not null,       -- ex: "letra_aprovada", "foto_enviada", "revisao_solicitada"
  detail     text,                -- descrição legível (ex: nome do arquivo, trecho da mensagem)
  actor      text not null default 'cliente', -- 'cliente' | 'admin' | 'system'
  created_at timestamptz not null default now()
);

create index if not exists order_events_order_idx on order_events ("orderId", created_at);

alter table order_events enable row level security;

drop policy if exists "service_role all order_events" on order_events;
create policy "service_role all order_events"
  on order_events for all
  to service_role
  using (true) with check (true);
