-- Autenticação do Login Kit do TikTok. Diferente do Instagram (token de 60
-- dias colado manualmente no env), o TikTok exige OAuth de verdade: access
-- token dura só 24h e precisa ser renovado via refresh_token (válido ~365
-- dias). Linha única (id=1), mesmo padrão de composer_settings.
create table if not exists tiktok_auth (
  id                       int primary key default 1,
  open_id                  text,
  access_token             text,
  refresh_token            text,
  access_token_expires_at  timestamptz,
  refresh_token_expires_at timestamptz,
  scope                    text,
  updated_at               timestamptz not null default now(),
  constraint tiktok_auth_singleton check (id = 1)
);

alter table tiktok_auth enable row level security;
