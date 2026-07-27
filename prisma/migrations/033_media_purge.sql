-- Higiene de storage: registra quando a mídia de um rascunho foi apagada.
-- Os textos ficam (são leves e servem de histórico); o que some é o peso —
-- imagem do post, cenas, áudio e vídeo final.
alter table content_drafts
  add column if not exists media_purged_at timestamptz;

comment on column content_drafts.media_purged_at is
  'Quando a mídia foi descartada (automático na rejeição, manual pelo admin).';
