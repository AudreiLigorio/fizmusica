-- Fila entre o Next.js (gera ingredientes: imagens KIE + música Suno) e o
-- worker local (só ele tem ffmpeg pra montar o vídeo — ver
-- scripts/video-worker/README.md). O worker faz polling nesta tabela.
create table if not exists video_jobs (
  id                uuid primary key default gen_random_uuid(),
  "contentDraftId"  uuid not null references content_drafts(id) on delete cascade,
  status            text not null default 'gerando_ingredientes',
    -- 'gerando_ingredientes' | 'pronto_pra_renderizar' | 'renderizando' | 'concluido' | 'falhou'
  recipe            jsonb not null, -- { scenes: [{description, caption}], songTheme, songStyle, platform }
  scene_image_task_ids jsonb,       -- taskIds da KIE enquanto as imagens geram (assíncrono)
  scene_image_urls  jsonb,          -- preenchido quando as N imagens ficam prontas
  song_task_id      text,           -- taskId do Suno enquanto a música gera (assíncrono)
  song_url          text,           -- mp3 completo do Suno
  video_url         text,
  error             text,
  claimed_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists video_jobs_status_idx on video_jobs (status, created_at);
create index if not exists video_jobs_draft_idx on video_jobs ("contentDraftId");

alter table video_jobs enable row level security;
drop policy if exists "service_role all video_jobs" on video_jobs;
create policy "service_role all video_jobs"
  on video_jobs for all
  to service_role
  using (true) with check (true);

-- content_drafts ganha o resultado final do vídeo (visível na tela de qualificação)
alter table content_drafts add column if not exists video_url text;
