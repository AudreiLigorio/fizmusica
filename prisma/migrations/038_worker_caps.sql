-- Assinatura do worker que montou o vídeo. O worker roda na máquina do usuário
-- e carrega o código ao INICIAR: um processo aberto antes de um deploy segue
-- executando a versão antiga indiferente ao que está no disco. Já custou dois
-- vídeos (narração não mixada e ingredientes apagados) sem nenhum sinal na
-- tela. Ausência desta coluna preenchida = worker anterior a esta checagem.
alter table video_jobs
  add column if not exists worker_caps text[];

comment on column video_jobs.worker_caps is
  'Capacidades do worker que processou o job. Nulo = worker antigo.';
