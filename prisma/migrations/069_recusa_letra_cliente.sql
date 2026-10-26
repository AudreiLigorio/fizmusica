-- Recusa do fornecedor que o CLIENTE pode resolver.
--
-- Hoje, quando o Suno recusa a letra, o pedido só fica `sunoStatus=FAILED` com
-- a mensagem em inglês no painel do admin. A `/api/orders` remove esse campo de
-- propósito (nada de "suno" chega ao navegador do cliente) e a tela dele só
-- reage a RELEASED — ou seja, ele fica em "em produção" para sempre, sem sinal
-- nenhum. Tem gente esperando há dez dias por música paga.
--
-- Guarda um CÓDIGO, não a frase pronta: o texto que o cliente lê mora no
-- componente, pode ser melhorado sem migration, e o motivo cru do fornecedor
-- continua no `sunoError` (admin) e no histórico do pedido.
--
-- Só recebe código a recusa que o cliente consegue de fato resolver. Hoje é uma
-- só — letra protegida, porque a letra é editável por ele. Bloqueio de nome de
-- artista no estilo já se conserta sozinho (auto-retry sem o termo) e o estilo
-- nem é editável na área dele; mandar isso faria a pessoa mexer na letra à toa.
-- Recusa não reconhecida também não vem pra cá: sem saber se ele pode agir,
-- dizer "tem algo errado com sua letra" levaria alguém a reescrever um texto
-- que estava bom.
alter table orders
  add column if not exists lyrics_rejection text;

comment on column orders.lyrics_rejection is
  'Código da recusa que o cliente precisa resolver (ex.: letra_protegida). Null = nada pendente com ele. O motivo cru do fornecedor fica em sunoError.';

-- Termo que o sistema REMOVEU sozinho do estilo para conseguir gerar.
--
-- Quando o Suno bloqueia nome de artista nas tags ("estilo Racionais"), o
-- código já tira o termo e regenera automaticamente — e até hoje ninguém era
-- avisado. A pessoa pediu uma referência, recebeu uma música sem ela e nunca
-- soube que o pedido tinha sido alterado. Mudança automática no pedido de
-- alguém precisa ser contada, com o que mudou e por quê.
--
-- Guarda só o termo; a frase mora na tela, pelo mesmo motivo do código acima.
alter table orders
  add column if not exists estilo_termo_removido text;

comment on column orders.estilo_termo_removido is
  'Termo de estilo removido automaticamente para contornar bloqueio do fornecedor (ex.: nome de artista). Exibido ao cliente como aviso do que foi alterado.';
