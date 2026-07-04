-- Parametriza o limite de fotos por produto (era hardcoded em 8 lugares do código).
-- Default 10 (a capa gerada pela IA não conta neste limite — é contada à parte).
ALTER TABLE products ADD COLUMN IF NOT EXISTS photo_limit integer NOT NULL DEFAULT 10;

-- Box Premium já previsto com 13 (produto ainda inativo/não habilitado).
UPDATE products SET photo_limit = 13 WHERE id = 'prod-premium';
