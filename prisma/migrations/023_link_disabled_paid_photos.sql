-- Redesenho do expurgo de pedidos pagos: o MP3/letra NUNCA são apagados (a Fiz
-- Música retém a obra por direito — Licença de Uso, cláusulas 6+9). O que
-- "expira" é o ACESSO PÚBLICO ao link/QR; nesse mesmo evento, as FOTOS do
-- pedido são removidas (dado mais sensível — imagem de pessoa real).

-- Marca quando o link público foi desativado (null = link ainda ativo/permanente).
alter table generated_music add column if not exists link_disabled_at timestamptz;

-- Contador dedicado no relatório de expurgo (distinto de photos_purged, que é
-- do lead não convertido).
alter table purge_log add column if not exists paid_photos_purged integer not null default 0;
