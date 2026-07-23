# Agentes de conteúdo — FizMusica

Especificação dos papéis do pipeline de criação → qualificação → publicação de
conteúdo pra redes sociais (Instagram `@fiz_musica`, TikTok `@fizmusica`,
YouTube `@Fizmusica10`). Cada um tem missão e entradas/saídas definidas; os
que ainda não existem estão marcados com a fase planejada.

## 1. Agente de Criação — ✅ existe

**Missão:** gerar um rascunho de post (legenda + hashtags + imagem) com a voz
da FizMusica — caloroso, emocional — a partir de um tema livre ou da história
real de um pedido consentido, pronto pra revisão humana.

**Entradas:** tema livre (texto) OU dados de um pedido com
`publication_consent=true` (nome da música, subcategoria, trecho da letra) +
plataforma-alvo.

**Saídas:** legenda + hashtags (texto), imagem (URL gerada via KIE.ai),
registro em `content_drafts` com status `rascunho`.

**Código:** `lib/content/caption.ts` (Gemini), `lib/content/kie-image.ts`
(KIE.ai), `lib/content/generate.ts` (orquestrador).

## 2. Agente de Qualificação — hoje é humano

**Missão:** decidir se o rascunho está pronto pra ir ao ar. Não existe IA
aqui — quem qualifica é o admin, no painel.

**Entradas:** o rascunho completo (legenda, hashtags, imagem, origem) exibido
em `/admin/conteudo`.

**Saídas:** status `aprovado` ou `rejeitado` (+ motivo opcional), registrado
em `content_drafts`/`content_events`.

Poderia um dia virar um pré-filtro de IA antes da revisão humana final — não
planejado, é só uma porta aberta.

## 3. Agente Publicador — Instagram — Fase 2, não construído

**Missão:** pegar um rascunho aprovado e publicar em `@fiz_musica` via Meta
Graph API.

**Entradas:** rascunho `aprovado` com `platform="instagram"`.

**Saídas:** post publicado + ID salvo pra rastreio; status vira `publicado`.

Depende da aprovação de Content Publishing do app Meta (mesma fila da
aprovação do WhatsApp Business Cloud).

## 4. Agente Publicador — YouTube — Fase 3, não construído

**Missão:** publicar vídeo/Short no canal `@Fizmusica10` via YouTube Data API.

**Entradas:** rascunho `aprovado` com `platform="youtube"` — **precisa de
vídeo**, não só imagem (gap real: a Fase 1 só gera imagem).

**Saídas:** vídeo publicado + video ID salvo; status `publicado`.

Restrição real: quota padrão da API cobre ~6 uploads/dia.

## 5. Agente Publicador — TikTok — Fase 4, não construído

**Missão:** publicar vídeo em `@fizmusica` via Content Posting API.

**Entradas:** rascunho `aprovado` com `platform="tiktok"` — mesmo gap de
vídeo do YouTube.

**Saídas:** vídeo publicado; status `publicado`.

Restrição real: sem aprovação plena da TikTok, o vídeo só chega como
rascunho privado no inbox do app — precisa de toque manual.

---

Não há um agente separado de SEO/hashtags: hoje isso é responsabilidade do
Agente de Criação (as hashtags saem junto com a legenda). Só valeria separar
se um dia for preciso otimizar por plataforma de forma diferente (título/
descrição/tags do YouTube são um jogo bem distinto de hashtag do
Instagram/TikTok) — especulativo, sem uso real ainda.
