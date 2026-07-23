-- Agentes de conteúdo (Fase 1): rascunhos gerados por IA (legenda via Gemini +
-- imagem via KIE.ai) aguardando aprovação manual do admin. Nada aqui publica em
-- nenhuma rede — é só o pipeline de criação → qualificação.
create table if not exists content_drafts (
  id               uuid primary key default gen_random_uuid(),
  platform         text not null,                     -- 'instagram' | 'tiktok' | 'youtube'
  status           text not null default 'rascunho',  -- 'rascunho' | 'aprovado' | 'rejeitado'
  source_type      text not null,                     -- 'pedido' | 'generico'
  "sourceOrderId"  text references orders(id) on delete set null,
  topic            text,                               -- tema livre, quando source_type = 'generico'
  caption          text,
  hashtags         text,
  image_url        text,
  image_task_id    text,                               -- taskId da KIE.ai enquanto a imagem gera (assíncrono)
  image_error      text,                               -- mensagem de falha da geração de imagem, se houver
  prompt_used      text,                               -- prompt enviado ao Gemini/KIE (auditoria/reprodutibilidade)
  rejection_reason text,
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists content_drafts_status_idx on content_drafts (status, created_at);

-- Log de eventos do rascunho — append-only, mesmo padrão de order_events.
create table if not exists content_events (
  id               uuid primary key default gen_random_uuid(),
  "contentDraftId" uuid not null references content_drafts(id) on delete cascade,
  type             text not null,   -- 'rascunho_criado' | 'imagem_gerada' | 'aprovado' | 'rejeitado'
  detail           text,
  actor            text not null default 'system', -- 'admin' | 'system'
  created_at       timestamptz not null default now()
);

create index if not exists content_events_draft_idx on content_events ("contentDraftId", created_at);

alter table content_drafts enable row level security;
drop policy if exists "service_role all content_drafts" on content_drafts;
create policy "service_role all content_drafts"
  on content_drafts for all
  to service_role
  using (true) with check (true);

alter table content_events enable row level security;
drop policy if exists "service_role all content_events" on content_events;
create policy "service_role all content_events"
  on content_events for all
  to service_role
  using (true) with check (true);
