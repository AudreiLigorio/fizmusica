-- Coletor de métricas do Instagram. Guarda SÉRIE HISTÓRICA, não foto do
-- momento: o Instagram não devolve retroativo no detalhe que interessa, então
-- o que não for coletado hoje não existe depois. Começa a acumular agora pra
-- que em 4-6 semanas haja base real ("gancho de pergunta salva mais?",
-- "sábado rende mais que quarta?") — hoje, com 4 seguidores, seria ruído.
create table if not exists content_metrics (
  id                 bigserial primary key,
  draft_id           uuid references content_drafts(id) on delete cascade,
  media_id           text not null,
  dia                date not null,
  reach              int,
  likes              int,
  comments           int,
  saved              int,
  shares             int,
  total_interactions int,
  coletado_em        timestamptz not null default now(),
  unique (media_id, dia)
);

create index if not exists content_metrics_draft_idx on content_metrics(draft_id, dia desc);

create table if not exists account_metrics (
  dia             date primary key,
  followers_count int,
  media_count     int,
  coletado_em     timestamptz not null default now()
);

-- Comentários: viram lead quando trazem intenção de compra. A resposta é
-- SEMPRE humana — resposta automática em post emocional queima a marca.
create table if not exists content_comments (
  id              text primary key,          -- id do comentário no Instagram
  media_id        text not null,
  draft_id        uuid references content_drafts(id) on delete set null,
  username        text,
  texto           text,
  intencao_compra boolean not null default false,
  respondido      boolean not null default false,
  criado_em       timestamptz,
  coletado_em     timestamptz not null default now()
);

create index if not exists content_comments_pendentes_idx
  on content_comments(intencao_compra, respondido, criado_em desc);

alter table content_metrics enable row level security;
alter table account_metrics enable row level security;
alter table content_comments enable row level security;
