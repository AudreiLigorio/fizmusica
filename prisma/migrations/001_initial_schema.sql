-- FizMusica — Schema inicial
-- Rode no SQL Editor do Supabase: supabase.com → SQL Editor → New query

create type order_status as enum ('PENDING', 'IN_PRODUCTION', 'DELIVERED', 'ABANDONED');
create type payment_status as enum ('UNPAID', 'PAID', 'REFUNDED');

-- ============================================================
-- PRODUCTS
-- ============================================================
create table products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  price       numeric(10,2) not null,
  image_url   text,
  active      boolean not null default true,
  featured    boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- ORDERS
-- ============================================================
create table orders (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  email          text not null,
  whatsapp       text not null,
  context        text not null,
  subcategory    text not null,
  musical_style  text not null,
  voice_type     text not null,
  emotion        text not null,
  status         order_status not null default 'PENDING',
  payment_status payment_status not null default 'UNPAID',
  product_id     uuid references products(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ============================================================
-- ORDER_ANSWERS
-- ============================================================
create table order_answers (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  question    text not null,
  answer      text not null,
  position    int not null,
  context     text not null,
  subcategory text not null
);

-- ============================================================
-- PAYMENTS
-- ============================================================
create table payments (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null unique references orders(id),
  amount           numeric(10,2) not null,
  status           payment_status not null default 'UNPAID',
  mp_payment_id    text,
  mp_preference_id text,
  mp_status        text,
  paid_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ============================================================
-- GENERATED_MUSIC
-- ============================================================
create table generated_music (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null unique references orders(id),
  mp3_url      text,
  lyrics       text,
  image_url    text,
  person_name  text,
  music_name   text,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ============================================================
-- updated_at automático via trigger
-- ============================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_products_updated_at before update on products
  for each row execute procedure set_updated_at();

create trigger trg_orders_updated_at before update on orders
  for each row execute procedure set_updated_at();

create trigger trg_payments_updated_at before update on payments
  for each row execute procedure set_updated_at();

create trigger trg_generated_music_updated_at before update on generated_music
  for each row execute procedure set_updated_at();
