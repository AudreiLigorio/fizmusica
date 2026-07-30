-- Resposta automática a comentário com intenção de compra.
--
-- A Meta permite UMA resposta privada (DM) por comentário, até 7 dias depois —
-- e ela fura a janela de 24h. É a mecânica padrão de conversão no Instagram:
-- "comenta PREÇO que eu te mando no direct".
alter table content_settings
  add column if not exists auto_resposta        boolean not null default false,
  add column if not exists resposta_publica     text default 'Te chamei no direct 💜',
  add column if not exists resposta_dm          text default 'Oi! Que bom que você se interessou 💜 A gente transforma a história de vocês em uma música exclusiva. É só contar a história aqui: https://www.fizmusica.com.br/criar',
  add column if not exists auto_resposta_luto   boolean not null default true;

comment on column content_settings.auto_resposta_luto is
  'true = NUNCA responde automaticamente em peça de luto/homenagem póstuma.';

-- Marca o que já foi respondido: a Meta aceita uma resposta privada por
-- comentário, e repetir seria erro de API além de incômodo pra pessoa.
alter table content_comments
  add column if not exists dm_enviado_em      timestamptz,
  add column if not exists resposta_publica_em timestamptz,
  add column if not exists erro_resposta      text;
