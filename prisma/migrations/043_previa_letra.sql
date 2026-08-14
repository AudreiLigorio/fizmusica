-- Prévia da letra durante o wizard: mostra o refrão antes do pagamento pra
-- gerar expectativa e converter. Esta migration só cria os freios — a rota e a
-- tela vêm depois.
--
-- Dois tetos, com papéis diferentes:
--
--  * por sessão do wizard (padrão 2) — é o limite do produto. Antes de pagar a
--    pessoa só enxerga o refrão, e refinar o que não se lê inteiro tem retorno
--    decrescente rápido: a 2ª geração cobre o "esqueci de contar um detalhe".
--    Depois do pagamento continuam valendo as 3 revisões (REPROCESS_LIMIT), que
--    são outra operação — lá a IA parte da letra existente em vez de recomeçar.
--
--  * por IP/dia (padrão 30) — é rede de proteção contra script, NÃO limite por
--    pessoa. Operadora móvel no Brasil usa CGNAT: milhares de celulares saem
--    pelo mesmo IPv4. Número apertado aqui barra comprador de verdade num dia
--    de tráfego bom, e perder uma compra custa muito mais que os centavos de
--    Gemini economizados. Pra bater em 30 é preciso refazer o questionário
--    inteiro ~15 vezes no mesmo dia.
--
-- Os dois ficam em composer_settings, junto do prompt e do modelo, pra serem
-- calibrados sem deploy se aparecer bloqueio indevido.
alter table composer_settings
  add column if not exists preview_max_session int not null default 2,
  add column if not exists preview_max_ip_day  int not null default 30;

comment on column composer_settings.preview_max_session is 'Gerações de prévia por sessão do wizard. Só conta quando a história muda.';
comment on column composer_settings.preview_max_ip_day  is 'Teto diário por IP. Rede contra script — manter folgado por causa do CGNAT.';

-- Contador diário por IP. Guarda o HASH do IP, nunca o IP: o bloqueio funciona
-- igual e a gente não cria um novo depósito de dado pessoal pra defender na
-- LGPD. Uma linha por (hash, dia); linhas velhas são descartáveis.
create table if not exists preview_rate_limit (
  ip_hash    text        not null,
  day        date        not null,
  count      int         not null default 0,
  updated_at timestamptz not null default now(),
  primary key (ip_hash, day)
);

comment on table preview_rate_limit is 'Contador diário de prévias por IP (hash). Descartável: linhas antigas podem ser apagadas a qualquer momento.';

-- Padrão do projeto: RLS ligado em tudo. Sem policy = só o service role lê e
-- escreve, que é exatamente quem precisa (a rota roda no servidor).
alter table preview_rate_limit enable row level security;
