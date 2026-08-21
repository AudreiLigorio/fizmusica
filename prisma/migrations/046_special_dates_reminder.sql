-- Fase 2 de "Datas especiais": lembrete automático ~15 dias antes.
--
-- `email`/`conta_nome` ficam gravados no momento da criação (em vez de
-- resolver via auth.admin.getUserById a cada linha no cron, uma chamada por
-- pedido no meio de um loop diário) — mesmo padrão de `orders.email`, que
-- também não busca a conta toda vez que precisa mostrar o e-mail.
--
-- `last_reminder_sent_for_year` guarda o ANO pro qual já mandamos o aviso —
-- a data se repete todo ano, então "já mandei" precisa ser por ocorrência,
-- não um boolean único (senão o aviso do ano que vem nunca mais sai).

alter table special_dates
  add column if not exists email text,
  add column if not exists conta_nome text,
  add column if not exists last_reminder_sent_for_year int;
