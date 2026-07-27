-- Roteirista: o rascunho passa a guardar a DECISÃO editorial (persona,
-- emoção-alvo, história) e o parecer do revisor crítico, não só o texto final.
-- Serve pra três coisas: o admin entender por que a peça é daquele jeito,
-- reaproveitar o roteiro na geração do vídeo sem redigitar, e — mais pra
-- frente — cruzar o que performou com a emoção/persona que originou a peça.
alter table content_drafts
  add column if not exists roteiro          jsonb,   -- Roteiro completo (persona, emoção, história, cenas, música)
  add column if not exists emocao_alvo      text,    -- desnormalizado do roteiro pra filtrar/agrupar sem abrir o jsonb
  add column if not exists persona          text,    -- idem
  add column if not exists quality_report   jsonb,   -- Parecer do revisor: nota, itens do crivo, correções
  add column if not exists quality_score    numeric, -- nota (0-10), desnormalizada
  add column if not exists needs_human      boolean not null default false; -- reprovou as duas passadas

comment on column content_drafts.roteiro is
  'Roteiro gerado por lib/content/roteirista.ts — decisão editorial completa.';
comment on column content_drafts.needs_human is
  'true = nem a reescrita passou no crivo; chegou ao painel marcado pra revisão humana.';
