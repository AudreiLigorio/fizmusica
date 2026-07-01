-- ============================================================
-- MIGRATION 018 — Integração Suno (KIE.ai)
-- Geração automática da música a partir da letra aprovada.
-- A música gerada fica "aguardando aprovação do admin" antes da entrega.
-- ============================================================

-- Estado da geração no pedido
alter table orders add column if not exists "sunoTaskId" text;
-- sunoStatus: null (não gerado) | GENERATING | READY | FAILED
alter table orders add column if not exists "sunoStatus" text;
alter table orders add column if not exists "sunoError"  text;
-- Variações retornadas pelo Suno (para o admin escolher): [{audioId,audioUrl,duration,imageUrl,title}]
alter table orders add column if not exists "sunoTracks" jsonb;

create index if not exists idx_orders_suno_task on orders ("sunoTaskId");

-- Modelo do Suno usado na geração (configurável no /admin/compositor)
alter table composer_settings add column if not exists "sunoModel" text not null default 'V5';
