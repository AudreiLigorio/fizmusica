-- FizMusica — Schema completo (Fase 2)
-- Rode no SQL Editor do Supabase após a migration 001
-- supabase.com → SQL Editor → New query

-- ============================================================
-- NOVOS ENUMS
-- ============================================================

create type delivery_status as enum ('PENDING', 'SENT', 'FAILED');
create type delivery_channel as enum ('WHATSAPP', 'EMAIL');
create type production_status as enum ('WAITING', 'IN_PROGRESS', 'DONE', 'FAILED');

-- ============================================================
-- CUSTOMERS
-- Comprador autenticado (Google / Magic Link)
-- ============================================================
create table customers (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid unique,                      -- auth.users.id (preenchido após auth)
  name       text not null,
  email      text not null unique,
  whatsapp   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_customers_updated_at before update on customers
  for each row execute procedure set_updated_at();

-- ============================================================
-- HONOREES
-- Pessoa homenageada (não precisa de login)
-- ============================================================
create table honorees (
  id         uuid primary key default gen_random_uuid(),
  order_id   text not null unique references orders(id) on delete cascade,
  name       text not null,
  whatsapp   text,
  email      text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- BRIEFS
-- Briefing gerado a partir das respostas do wizard
-- ============================================================
create table briefs (
  id         uuid primary key default gen_random_uuid(),
  order_id   text not null unique references orders(id) on delete cascade,
  content    text not null,                    -- texto consolidado do briefing
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_briefs_updated_at before update on briefs
  for each row execute procedure set_updated_at();

-- ============================================================
-- PRODUCTION_PROMPTS
-- Prompt gerado pelo sistema para produção da música
-- ============================================================
create table production_prompts (
  id         uuid primary key default gen_random_uuid(),
  order_id   text not null unique references orders(id) on delete cascade,
  prompt     text not null,
  version    int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_production_prompts_updated_at before update on production_prompts
  for each row execute procedure set_updated_at();

-- ============================================================
-- SONGS
-- Música produzida e publicada
-- ============================================================
create table songs (
  id           uuid primary key default gen_random_uuid(),
  order_id     text not null unique references orders(id) on delete cascade,
  title        text,
  lyrics       text,
  mp3_url      text,
  image_url    text,
  duration_sec int,
  status       production_status not null default 'WAITING',
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger trg_songs_updated_at before update on songs
  for each row execute procedure set_updated_at();

-- ============================================================
-- MUSIC_PUBLIC_ACCESS
-- URL pública temporária + QR Code da música
-- ============================================================
create table music_public_access (
  id         uuid primary key default gen_random_uuid(),
  song_id    uuid not null unique references songs(id) on delete cascade,
  slug       text not null unique,             -- identificador da URL pública
  qr_url     text,                             -- URL do QR Code gerado
  expires_at timestamptz,                      -- nulo = permanente
  created_at timestamptz not null default now()
);

-- ============================================================
-- DELIVERIES
-- Registro de cada tentativa de entrega (WhatsApp / Email)
-- ============================================================
create table deliveries (
  id         uuid primary key default gen_random_uuid(),
  order_id   text not null references orders(id) on delete cascade,
  channel    delivery_channel not null,
  recipient  text not null,                    -- número ou e-mail
  status     delivery_status not null default 'PENDING',
  sent_at    timestamptz,
  error      text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ORDER_STATUS_HISTORY
-- Auditoria de mudanças de status do pedido
-- ============================================================
create table order_status_history (
  id          uuid primary key default gen_random_uuid(),
  order_id    text not null references orders(id) on delete cascade,
  from_status "OrderStatus",
  to_status   "OrderStatus" not null,
  changed_by  text,                            -- user_id ou 'system'
  note        text,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- PRODUCT_DELIVERY_OPTIONS
-- Opções de prazo/urgência por produto
-- ============================================================
create table product_delivery_options (
  id           uuid primary key default gen_random_uuid(),
  product_id   text not null references products(id) on delete cascade,
  label        text not null,                  -- ex: "Normal (5 dias)"
  days         int not null,                   -- prazo em dias úteis
  price_extra  numeric(10,2) not null default 0,  -- acréscimo ao preço base
  active       boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger trg_product_delivery_options_updated_at before update on product_delivery_options
  for each row execute procedure set_updated_at();

-- ============================================================
-- WIZARD_OCCASIONS
-- Ocasiões do wizard (ex: Amor, Família, Gravidez)
-- ============================================================
create table wizard_occasions (
  id         uuid primary key default gen_random_uuid(),
  label      text not null,
  emoji      text,
  slug       text not null unique,
  active     boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_wizard_occasions_updated_at before update on wizard_occasions
  for each row execute procedure set_updated_at();

-- ============================================================
-- WIZARD_SUBCATEGORIES
-- Subcategorias por ocasião (ex: Pedido de Namoro, Casamento)
-- ============================================================
create table wizard_subcategories (
  id          uuid primary key default gen_random_uuid(),
  occasion_id uuid not null references wizard_occasions(id) on delete cascade,
  label       text not null,
  emoji       text,
  slug        text not null unique,
  active      boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_wizard_subcategories_updated_at before update on wizard_subcategories
  for each row execute procedure set_updated_at();

-- ============================================================
-- WIZARD_QUESTIONS
-- Perguntas por subcategoria
-- ============================================================
create table wizard_questions (
  id             uuid primary key default gen_random_uuid(),
  subcategory_id uuid not null references wizard_subcategories(id) on delete cascade,
  label          text not null,
  placeholder    text,
  type           text not null default 'text',   -- text | select | textarea
  required       boolean not null default true,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger trg_wizard_questions_updated_at before update on wizard_questions
  for each row execute procedure set_updated_at();

-- ============================================================
-- WIZARD_QUESTION_OPTIONS
-- Opções de resposta para perguntas do tipo select
-- ============================================================
create table wizard_question_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references wizard_questions(id) on delete cascade,
  label       text not null,
  value       text not null,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================

create index idx_honorees_order_id on honorees(order_id);
create index idx_briefs_order_id on briefs(order_id);
create index idx_songs_order_id on songs(order_id);
create index idx_songs_status on songs(status);
create index idx_deliveries_order_id on deliveries(order_id);
create index idx_deliveries_status on deliveries(status);
create index idx_order_status_history_order_id on order_status_history(order_id);
create index idx_music_public_access_slug on music_public_access(slug);
create index idx_wizard_subcategories_occasion_id on wizard_subcategories(occasion_id);
create index idx_wizard_questions_subcategory_id on wizard_questions(subcategory_id);
create index idx_wizard_question_options_question_id on wizard_question_options(question_id);
create index idx_product_delivery_options_product_id on product_delivery_options(product_id);
create index idx_customers_email on customers(email);
