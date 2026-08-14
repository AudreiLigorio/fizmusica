-- Expurgo das sessões do wizard.
--
-- `wizard_sessions` nunca foi tocada pelo expurgo: ela guarda nome, e-mail,
-- WhatsApp e a história inteira que a pessoa contou, e só é apagada quando
-- alguém clica em "começar do zero". Ou seja, na prática nunca — a sessão mais
-- antiga em produção é de junho/2026. A prévia da letra agravou isso, porque
-- agora a sessão guarda também a música gerada.
--
-- Pior: sem isso o expurgo do lead era teatro. Apagávamos o pedido não pago aos
-- 30 dias enquanto a MESMA história continuava viva na sessão, indefinidamente.
--
-- Por isso o corte reusa `lead_days` em vez de ganhar um número próprio: é a
-- mesma política ("dado de lead não convertido vive N dias"), e dois números
-- separados poderiam divergir e recriar exatamente o furo acima — sessão
-- sobrevivendo ao pedido que ela duplica.
alter table purge_log
  add column if not exists sessions_purged int not null default 0;

comment on column purge_log.sessions_purged is 'Sessões do wizard apagadas na execução (mesmo corte de lead_days).';
