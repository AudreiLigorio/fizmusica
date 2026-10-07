-- ============================================================
-- MIGRATION 066 — Denunciar música da Rede
-- ============================================================
--
-- Exigência da política de conteúdo gerado por usuário da Play Store: quem
-- ouve uma música da Rede precisa poder denunciá-la, e o Fiz Música precisa
-- poder tirá-la do ar. Vale para o site também (é o mesmo código).
--
-- `rede_oculta` é decisão do ADMIN, separada de `publication_consent` (que é
-- decisão do CLIENTE). Misturar as duas apagaria a escolha do cliente: ao
-- "voltar à Rede" não saberíamos se ele tinha autorizado. Na Rede = consent
-- E entregue E NÃO oculta.
--
-- `music_reports` referencia orders com ON DELETE CASCADE: tabela nova sem
-- cascade trava o expurgo LGPD (já aconteceu com `payments`, 2026-07-29).
-- O rate limit usa a própria tabela (ip_hash + created_at) — sem tabela extra.

alter table orders add column if not exists rede_oculta boolean not null default false;

create table if not exists music_reports (
  id          uuid primary key default gen_random_uuid(),
  "orderId"   text not null references orders(id) on delete cascade,
  motivo      text not null,
  detalhe     text,
  sessao      text,
  user_id     uuid,
  ip_hash     text,
  status      text not null default 'aberta',
  created_at  timestamptz not null default now()
);

create index if not exists music_reports_order_idx on music_reports ("orderId");
create index if not exists music_reports_ip_idx on music_reports (ip_hash, created_at);

-- Só o servidor (service role) lê e escreve; nenhuma policy para anon/authenticated.
alter table music_reports enable row level security;
