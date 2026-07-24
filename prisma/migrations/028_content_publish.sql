-- Publicação de verdade nas redes (começando pelo Instagram). Rastreia o que
-- já foi publicado, o id do post na plataforma (pra montar o link) e erro, se
-- houver. Não muda o fluxo de aprovação — só um rascunho 'aprovado' pode
-- publicar (regra na API), aqui só registramos o resultado.
alter table content_drafts add column if not exists published_at          timestamptz;
alter table content_drafts add column if not exists published_platform_id  text; -- id do media na rede (IG media id, etc.)
alter table content_drafts add column if not exists published_permalink    text; -- link público do post, quando a API devolve
alter table content_drafts add column if not exists publish_error          text;
