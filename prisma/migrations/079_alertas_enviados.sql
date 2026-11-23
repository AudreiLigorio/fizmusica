-- 079 — registro de alertas operacionais já enviados
--
-- Em 23/11/2026 os créditos pré-pagos do Gemini acabaram e TODA prévia de
-- letra falhou por horas sem ninguém saber: a tela cai num estado calmo de
-- propósito (não trava a venda), então do lado de fora nada parecia quebrado.
-- Agora a falta de crédito (Google ou Suno/KIE) dispara e-mail na hora.
--
-- Esta tabela é só a trava "uma vez por dia": cada alerta tem uma chave com o
-- dia (`falta-credito:google:2026-11-23`). Inserir é atômico na chave
-- primária — duas falhas simultâneas não mandam dois e-mails, e uma falha por
-- minuto não vira 1.440 e-mails.
--
-- Não guarda dado de cliente. Fechada ao PostgREST público (RLS sem política):
-- só o service_role grava.

create table if not exists public.alertas_enviados (
  chave      text primary key,
  enviado_em timestamptz not null default now()
);

alter table public.alertas_enviados enable row level security;
