-- Recursos por plano: cada produto passa a declarar o que entrega.
--
-- A ideia é que "plano" deixe de ser só nome+preço e vire uma lista de
-- recursos parametrizável — o mesmo código atende Essencial (só a música) e
-- Presente Premium (tudo), sem `if` por nome de produto espalhado no sistema.
--
-- DEFAULT TRUE de propósito: no dia em que isto sobe, os pedidos já pagos e o
-- produto em venda continuam com TODOS os recursos que sempre tiveram. Nenhum
-- cliente perde algo que comprou. Plano novo nasce com tudo ligado e é o admin
-- que desmarca o que aquele plano não inclui.
--
-- Fotos NÃO viram booleano aqui: `products.photo_limit` já cumpre esse papel
-- (0 = plano sem fotos). Um booleano paralelo seria uma segunda fonte de
-- verdade que uma hora divergiria do limite.
alter table products
  add column if not exists feat_lyrics_sync boolean not null default true,  -- letra sincronizada no player
  add column if not exists feat_qrcode      boolean not null default true,  -- QR Code do presente
  add column if not exists feat_download    boolean not null default true,  -- baixar o MP3
  add column if not exists feat_revision    boolean not null default true;  -- revisão/ajustes inclusos

comment on column products.feat_lyrics_sync is 'Letra sincronizada no player. Desligado = mostra a letra estática.';
comment on column products.feat_qrcode      is 'QR Code do presente (área do cliente e player).';
comment on column products.feat_download    is 'Botão de baixar o MP3.';
comment on column products.feat_revision    is 'Revisão inclusa ("Não gostei dessa versão").';
