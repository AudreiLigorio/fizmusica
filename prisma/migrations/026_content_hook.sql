-- Gancho: frase curta (4-8 palavras) queimada na imagem gerada, estilo "quote
-- card" — separado da legenda (que passa a ser curta, com CTA) porque um é o
-- texto que a IA de imagem tenta renderizar DENTRO da imagem, e o outro é o
-- texto do post que acompanha.
alter table content_drafts add column if not exists hook_text text;
