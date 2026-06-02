-- FizMusica — Row Level Security (Fase 1)
-- Rode no SQL Editor do Supabase
-- supabase.com → SQL Editor → New query

-- ============================================================
-- HABILITA RLS EM TODAS AS TABELAS
-- ============================================================

alter table products               enable row level security;
alter table orders                 enable row level security;
alter table order_answers          enable row level security;
alter table payments               enable row level security;
alter table generated_music        enable row level security;
alter table customers              enable row level security;
alter table honorees               enable row level security;
alter table briefs                 enable row level security;
alter table production_prompts     enable row level security;
alter table songs                  enable row level security;
alter table music_public_access    enable row level security;
alter table deliveries             enable row level security;
alter table order_status_history   enable row level security;
alter table product_delivery_options enable row level security;
alter table wizard_occasions       enable row level security;
alter table wizard_subcategories   enable row level security;
alter table wizard_questions       enable row level security;
alter table wizard_question_options enable row level security;

-- ============================================================
-- TABELAS PÚBLICAS — leitura anônima permitida
-- (wizard, produtos, página pública da música)
-- ============================================================

create policy "public read products"
  on products for select
  using (true);

create policy "public read wizard_occasions"
  on wizard_occasions for select
  using (active = true);

create policy "public read wizard_subcategories"
  on wizard_subcategories for select
  using (active = true);

create policy "public read wizard_questions"
  on wizard_questions for select
  using (true);

create policy "public read wizard_question_options"
  on wizard_question_options for select
  using (true);

create policy "public read music_public_access"
  on music_public_access for select
  using (expires_at is null or expires_at > now());

-- ============================================================
-- SERVICE_ROLE — acesso total ao backend
-- Todas as operações de escrita e leitura sensível
-- ============================================================

create policy "service_role all orders"
  on orders for all
  to service_role
  using (true) with check (true);

create policy "service_role all order_answers"
  on order_answers for all
  to service_role
  using (true) with check (true);

create policy "service_role all payments"
  on payments for all
  to service_role
  using (true) with check (true);

create policy "service_role all generated_music"
  on generated_music for all
  to service_role
  using (true) with check (true);

create policy "service_role all customers"
  on customers for all
  to service_role
  using (true) with check (true);

create policy "service_role all honorees"
  on honorees for all
  to service_role
  using (true) with check (true);

create policy "service_role all briefs"
  on briefs for all
  to service_role
  using (true) with check (true);

create policy "service_role all production_prompts"
  on production_prompts for all
  to service_role
  using (true) with check (true);

create policy "service_role all songs"
  on songs for all
  to service_role
  using (true) with check (true);

create policy "service_role all music_public_access"
  on music_public_access for all
  to service_role
  using (true) with check (true);

create policy "service_role all deliveries"
  on deliveries for all
  to service_role
  using (true) with check (true);

create policy "service_role all order_status_history"
  on order_status_history for all
  to service_role
  using (true) with check (true);

create policy "service_role all product_delivery_options"
  on product_delivery_options for all
  to service_role
  using (true) with check (true);

create policy "service_role all wizard_occasions"
  on wizard_occasions for all
  to service_role
  using (true) with check (true);

create policy "service_role all wizard_subcategories"
  on wizard_subcategories for all
  to service_role
  using (true) with check (true);

create policy "service_role all wizard_questions"
  on wizard_questions for all
  to service_role
  using (true) with check (true);

create policy "service_role all wizard_question_options"
  on wizard_question_options for all
  to service_role
  using (true) with check (true);

create policy "service_role all products"
  on products for all
  to service_role
  using (true) with check (true);
