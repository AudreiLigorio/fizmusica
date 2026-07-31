-- Rastreamento de comportamento no site, primeira-parte (sem Google Analytics
-- nem pixel de terceiro). Duas razões: os dados precisam ficar no NOSSO banco
-- pro agente de análise cruzar com as métricas de rede, e ferramenta de
-- terceiro traria cookie de rastreio — que exige banner de consentimento e
-- complica a LGPD sem necessidade aqui.
--
-- NÃO guarda IP, nem user agent, nem nada que identifique a pessoa. O
-- `sessao` é um id anônimo gerado no navegador, que serve só pra ligar os
-- passos de uma mesma visita ("entrou → clicou → parou no passo 3").
create table if not exists site_events (
  id         bigserial primary key,
  sessao     text not null,
  evento     text not null,         -- pageview | cta_criar | wizard_passo | checkout | pago
  caminho    text,                  -- rota da página
  detalhe    text,                  -- passo do wizard, origem do clique etc.
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content  text,                -- slug do link rastreado (/r/<slug>)
  referrer   text,
  created_at timestamptz not null default now()
);

create index if not exists site_events_sessao_idx on site_events(sessao, created_at);
create index if not exists site_events_evento_idx on site_events(evento, created_at desc);
create index if not exists site_events_utm_idx    on site_events(utm_source, created_at desc);

alter table site_events enable row level security;
