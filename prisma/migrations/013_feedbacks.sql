-- Migration 013: tabela de feedbacks
create table if not exists feedbacks (
  id        uuid primary key default gen_random_uuid(),
  "orderId" uuid not null references orders(id) on delete cascade,
  token     uuid not null unique default gen_random_uuid(),
  rating    int,
  comment   text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists feedbacks_order_idx on feedbacks ("orderId");
