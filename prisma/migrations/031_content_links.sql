-- Atribuição de conteúdo: sem isto é impossível saber se um post virou venda.
-- Cada rascunho ganha um link curto próprio (/r/<slug>) que registra o clique e
-- redireciona pra landing do tema com UTM. Duas tabelas: o link (1 por
-- rascunho) e os cliques (append-only).
create table if not exists content_links (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  draft_id    uuid references content_drafts(id) on delete set null,
  tema        text,                 -- slug da landing de destino (null = /criar)
  platform    text not null,        -- de onde o tráfego deve vir (utm_source)
  destination text not null,        -- caminho final, já com UTM
  created_at  timestamptz not null default now()
);

-- Cliques: propositalmente SEM IP e SEM user agent completo. Contagem e origem
-- bastam pra decidir o que funciona, e dado que não é coletado não vaza nem
-- precisa ser expurgado (princípio da necessidade, art. 6º III da LGPD).
create table if not exists content_link_clicks (
  id         bigserial primary key,
  link_id    uuid not null references content_links(id) on delete cascade,
  referer    text,
  created_at timestamptz not null default now()
);

create index if not exists content_link_clicks_link_idx on content_link_clicks(link_id);
create index if not exists content_links_draft_idx on content_links(draft_id);

alter table content_links enable row level security;
alter table content_link_clicks enable row level security;

-- O rascunho aponta pro seu link (o admin copia isso pra bio/descrição).
alter table content_drafts add column if not exists link_slug text;
