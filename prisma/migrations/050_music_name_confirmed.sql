-- ============================================================
-- 050 — Título confirmado pelo cliente
-- ============================================================
-- O catálogo da Rede Fiz Música mostra "Uma canção de {ocasião}" em vez do
-- título real porque títulos antigos podem conter nome próprio: até hoje o
-- gerador caía pro nome do homenageado quando a IA falhava, e mesmo quando
-- não caía a IA às vezes tirava um nome da letra (ex.: "A Doce Espera de
-- Beatriz" — Beatriz nem estava no campo de homenageado).
--
-- Em vez de auditar/migrar os títulos legados um a um, marcamos só os que o
-- cliente viu e confirmou no passo de aprovar a letra. Esses são seguros por
-- dois motivos: o prompt agora proíbe nome próprio, e se mesmo assim houver
-- um nome foi o próprio cliente que escreveu — coberto pelo termo de
-- publicação que ele aceita.
--
-- Default false de propósito: todo pedido antigo segue com o título derivado,
-- sem regressão e sem vazamento. O catálogo vai ganhando título real conforme
-- pedidos novos passam pelo fluxo.
-- camelCase para bater com as colunas reais da tabela (orderId, musicName…).
alter table generated_music
  add column if not exists "musicNameConfirmed" boolean not null default false;

comment on column generated_music."musicNameConfirmed" is
  'true = título escolhido/confirmado pelo cliente ao aprovar a letra; só esses podem aparecer publicamente no catálogo.';
