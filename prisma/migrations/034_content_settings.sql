-- Parametrização do modo de operação do conteúdo. Linha única (id=1), mesmo
-- padrão de composer_settings e tiktok_auth.
--
--   manual → nada roda sozinho (o painel funciona como sempre)
--   semi   → o CMO produz no cronograma e a peça ESPERA aprovação no painel
--   auto   → o CMO produz e publica sozinho, respeitando as travas abaixo
create table if not exists content_settings (
  id                  int primary key default 1,
  modo                text not null default 'semi',           -- manual | semi | auto
  dias_semana         int[] not null default '{1,3,5,6}',     -- 0=dom … 6=sáb (padrão: seg, qua, sex, sáb)
  plataformas         text[] not null default '{instagram}',  -- redes que o CMO pode escolher
  -- Travas do modo automático (valem só quando modo='auto'):
  nota_minima_auto    numeric not null default 8,     -- abaixo disso, espera humano
  luto_sempre_manual  boolean not null default true,  -- despedida/homenagem póstuma nunca vai sozinha
  pedido_real_manual  boolean not null default true,  -- peça de história de cliente sempre passa por humano
  teto_semanal        int not null default 5,         -- máximo de publicações automáticas por semana
  updated_at          timestamptz not null default now(),
  constraint content_settings_singleton check (id = 1),
  constraint content_settings_modo check (modo in ('manual', 'semi', 'auto'))
);

insert into content_settings (id) values (1) on conflict (id) do nothing;

alter table content_settings enable row level security;

-- Marca as peças que nasceram do cronograma (e não do clique do admin), com a
-- justificativa editorial do CMO. Serve pra auditar as decisões dele depois.
alter table content_drafts
  add column if not exists origem_automatica boolean not null default false,
  add column if not exists cmo_briefing      jsonb;
