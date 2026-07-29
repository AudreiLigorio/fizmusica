-- Lições aprendidas: a crítica do admin ao rejeitar uma peça vira uma regra
-- generalizável, injetada em TODOS os prompts seguintes. É o que faz o sistema
-- evoluir sem depender de alguém editar markdown na mão.
--
-- Mora no banco, e não em arquivo, porque em produção (Vercel) o sistema de
-- arquivos é somente leitura: o app não consegue escrever no repositório.
create table if not exists content_licoes (
  id                uuid primary key default gen_random_uuid(),
  regra             text not null,           -- a lição já generalizada
  feedback_original text,                    -- o que o admin escreveu, cru
  origem_draft      text,                    -- gancho/tema da peça que gerou a crítica
  ativa             boolean not null default true,
  created_at        timestamptz not null default now()
);

create index if not exists content_licoes_ativa_idx on content_licoes(ativa, created_at desc);

alter table content_licoes enable row level security;
