-- ============================================================
-- 056 — Lembrete de data especial: dois avisos (10 e 2 dias)
-- ============================================================
-- Antes era UM aviso, 15 dias antes. O Audrei pediu dois: 10 dias (tempo de
-- encomendar e a música ficar pronta) e 2 dias (resgate de quem deixou pra
-- depois).
--
-- Precisa de coluna NOVA porque `last_reminder_sent_for_year` guarda o ano do
-- aviso já enviado — com dois avisos, o de 10 dias marcaria o ano e o de 2
-- dias nunca sairia. Uma coluna por aviso mantém a mesma ideia (marcar por
-- ANO, não por booleano) que já existia: a data se repete todo ano, então um
-- "já avisei" simples faria o aniversário ser lembrado uma vez na vida.
--
-- A coluna antiga passa a ser o registro do aviso de 10 dias — não é
-- renomeada de propósito: renomear exigiria mexer no código e no banco no
-- mesmo instante, e um deploy fora de ordem quebraria o cron. O nome fica
-- genérico, o comentário abaixo diz o que ele significa hoje.
alter table special_dates
  add column if not exists last_reminder_2d_for_year integer;

comment on column special_dates.last_reminder_sent_for_year is
  'Ano em que o aviso de 10 DIAS antes foi enviado (nulo = nunca).';
comment on column special_dates.last_reminder_2d_for_year is
  'Ano em que o aviso de 2 DIAS antes foi enviado (nulo = nunca).';
