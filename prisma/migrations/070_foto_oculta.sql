-- Capa da IA que o cliente pode LIGAR e DESLIGAR, em vez de apagar.
--
-- Hoje a capa gerada pela IA é copiada para `order_photos` (ver lib/suno/ingest.ts)
-- só para aparecer no carrossel do player, e na tela ela fica no meio das fotos do
-- cliente, com o mesmo "×". Quem apagava não tinha como trazer de volta: o arquivo
-- sai do storage junto, e só uma nova geração da música recriaria a cópia.
--
-- `oculta` resolve sem destruir nada: a linha e o arquivo continuam lá, e o player
-- simplesmente não mostra. Serve para qualquer foto, não só para a capa.
alter table order_photos add column if not exists oculta boolean not null default false;
