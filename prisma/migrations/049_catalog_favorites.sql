-- Ouvir na Rede Fiz Música — catálogo público (dentro da área logada) de
-- pedidos entregues com autorização de divulgação (publication_consent).
--
-- Sem tabela nova pro catálogo em si — é derivado ao vivo de orders +
-- generated_music, igual "Minhas músicas". Só o favorito precisa de
-- armazenamento (é o único dado que pertence à CONTA que está olhando, não
-- ao pedido de quem publicou).

-- orders.id é `text` no banco (apesar do nome sugerir uuid — mesma pegadinha
-- documentada em [[project_fizmusica_seguranca_rls_2026-06-23]] sobre o
-- schema.prisma estar desatualizado). Descoberto ao rodar esta migração:
-- FK contra `uuid` deu 42804 (tipos incompatíveis).
create table if not exists catalog_favorites (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  order_id   text not null references orders(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, order_id)
);

create index if not exists catalog_favorites_user_idx on catalog_favorites (user_id);

alter table catalog_favorites enable row level security;

drop policy if exists "service_role all catalog_favorites" on catalog_favorites;
create policy "service_role all catalog_favorites"
  on catalog_favorites for all
  to service_role
  using (true) with check (true);
