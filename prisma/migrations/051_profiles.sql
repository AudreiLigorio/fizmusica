-- ============================================================
-- 051 — Perfil do cliente (apelido + foto)
-- ============================================================
-- Decisão de produto (2026-08-26): apelido e foto são PRIVADOS — só o próprio
-- cliente vê, na aba Carreira. A Rede Fiz Música continua anônima de propósito
-- (mostra música, ocasião e capa; nunca quem fez).
--
-- Por isso o bucket é privado e servido por URL assinada, não público como o
-- de fotos do pedido — aquelas aparecem no player, estas não aparecem em lugar
-- nenhum além da própria conta. Se um dia o apelido virar autor público na
-- Rede, isso exige aceite separado: publication_consent autoriza publicar a
-- MÚSICA, não o rosto e o nome de quem comprou.

create table if not exists profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  apelido     text,
  avatar_path text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table profiles enable row level security;

-- Todo acesso passa pelas rotas de API (service_role), igual às outras tabelas
-- novas do projeto — o client anon nunca fala direto com a tabela.
drop policy if exists "profiles service_role" on profiles;
create policy "profiles service_role" on profiles
  for all to service_role using (true) with check (true);

-- Bucket privado dos avatares. `public = false` é o ponto: sem isso o arquivo
-- ficaria acessível a quem tivesse a URL, contrariando a decisão acima.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;
