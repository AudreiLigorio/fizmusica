-- Mesma história, redes diferentes. Cada rede é uma PEÇA própria (formato,
-- ritmo e CTA mudam), mas todas nascem da mesma história — e é essa ligação
-- que permite mostrar "esta história já foi publicada onde".
alter table content_drafts
  add column if not exists derivado_de uuid references content_drafts(id) on delete set null;

create index if not exists content_drafts_derivado_idx on content_drafts(derivado_de);

comment on column content_drafts.derivado_de is
  'Peça original da qual esta é adaptação para outra rede. Null = peça raiz.';
