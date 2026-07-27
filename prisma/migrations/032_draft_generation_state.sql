-- O rascunho passa a existir desde o primeiro segundo (status 'gerando') e a
-- guardar o motivo quando a geração falha. Antes a linha só nascia no fim: um
-- timeout no meio apagava o trabalho sem deixar rastro nenhum na tela.
alter table content_drafts
  add column if not exists generation_error text;

comment on column content_drafts.status is
  'gerando | rascunho | aprovado | rejeitado | falhou';
