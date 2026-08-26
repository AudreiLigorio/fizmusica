-- ============================================================
-- 052 — Apelido público na Rede (opt-in)
-- ============================================================
-- Decisão de produto (2026-08-26): o apelido pode aparecer publicamente pras
-- músicas que o cliente publica na Rede Fiz Música. Mas o `publication_consent`
-- existente autoriza publicar a MÚSICA — não foi pensado pra expor identidade
-- de ninguém, e o apelido é um campo novo que a maioria nem preencheu ainda.
--
-- Por isso: opt-in SEPARADO, default false. Sem essa trava, todo pedido já
-- publicado (68 hoje) passaria a expor o apelido do dono assim que ele
-- preenchesse o campo, sem nunca ter escolhido isso especificamente.
alter table profiles
  add column if not exists mostrar_apelido boolean not null default false;

comment on column profiles.mostrar_apelido is
  'true = o apelido aparece publicamente nas músicas que este usuário publica na Rede Fiz Música. Default false: precisa ser escolha explícita, separada do publication_consent (que só cobre a música).';
