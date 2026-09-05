-- ============================================================
-- MIGRATION 060 — Referência musical informada pelo cliente
-- ============================================================
--
-- Campo livre do wizard: "que música ou banda te lembra o que você
-- imagina?". Guardado como o cliente escreveu.
--
-- NUNCA vai direto pro Suno: o motor RECUSA nome de artista comercial e
-- bloqueia a geração inteira. Quem consome isto é o buildSunoStyle, que
-- traduz a referência em características sonoras (gênero, instrumentação,
-- andamento, timbre) e descarta o nome. Ver lib/composer/style.ts.
--
-- E NUNCA sai no catálogo: "música estilo Anitta" publicada na Rede é
-- associação indevida de marca. Fica no pedido, como as fotos.

alter table public.orders
  add column if not exists "style_reference" text;

comment on column public.orders."style_reference" is
  'Referência musical escrita pelo cliente (banda/música). Entra na tradução de estilo; nunca é enviada ao Suno nem exposta no catálogo.';
