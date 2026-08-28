# FizMusica — Documentação do Projeto

> Plataforma de **músicas personalizadas**: o cliente conta sua história num wizard, paga, aprova a letra (gerada por IA), a música é composta (Suno via KIE.ai) e ele recebe num player próprio com fotos e QR Code. Painel administrativo completo e área do cliente com login sem senha.

Domínio: **https://fizmusica.com.br**

> Este documento é reescrito por completo a cada revisão grande (não é changelog incremental). Reflete o estado e as decisões vigentes em **2026-07-08**. Para o histórico de commits, `git log`. Para a visão fundacional original do produto, ver `docs/master_context_full/MASTER_CONTEXT_FULL.md` (não editar — é o documento de visão de 2026-05-31).

---

## 1. Visão geral / posicionamento

FizMusica transforma uma história pessoal em uma música personalizada — não é "site de homenagem": serve para qualquer intenção (celebrar, agradecer, emocionar, surpreender, se declarar, contar uma história, até uma piada interna). A opção **"Composição Livre"** existe destacada no topo do wizard justamente para deixar isso evidente ([project_fizmusica_posicionamento_2026-07-02]).

Fluxo central hoje:

1. **Wizard** (`/criar`): ocasião → subcategoria → perguntas abertas → estilo/voz/emoção → dados de contato → fotos (opcional).
2. **Produto** (`/produtos`) e **pagamento** (`/checkout`, Mercado Pago Bricks: cartão, PIX com QR na tela, boleto).
3. **Aprovar letra** — a IA (Gemini) gera a letra a partir das respostas do wizard; o cliente edita/revisa (até 3 reprocessamentos) e **aprova**. É esse clique que dispara a composição da música.
4. **Geração automática da música** (Suno via KIE.ai) — assíncrona, dispara no momento da aprovação da letra.
5. **Escolha da versão** — o cliente recebe (normalmente) 2 versões e escolhe a principal (pode trocar depois).
6. **Player público** (`/m/[slug]`) com letra sincronizada (LRC automático), fotos do cliente, QR Code — liberado só após aceitar o **Termo de Entrega Digital**.
7. **Avaliação** (`/feedback/[token]`) e possibilidade de pedir **revisão** se não gostar.

Objetivo de produto: evoluir de venda avulsa para **relacionamento/recorrência** (área do cliente, cupons de fidelidade, futuro: assinatura/playlist, datas especiais).

**Modelo de negócio quanto a direitos autorais:** a empresa entrega a música como presente/encomenda e **pode publicar** (catálogo próprio/playlist) caso o cliente autorize (`publication_consent`) — não vende exclusividade registrável. Uso comercial da Suno via KIE.ai foi **confirmado por escrito** com o suporte da KIE (sem documento de licença por música — a Suno não fornece isso a eles).

---

## 2. Tecnologias (stack)

| Camada | Tecnologia |
|---|---|
| Framework | **Next.js 16** (App Router, Server/Client Components, Route Handlers) |
| Linguagem | TypeScript, React 19 |
| Estilo | Tailwind CSS 4 |
| Banco de dados | **PostgreSQL** (via **Supabase**) |
| Acesso a dados | `@supabase/supabase-js` — **não há Prisma Client nem `pg` rodando em runtime**; `prisma/schema.prisma` e `prisma/migrations/*.sql` são só referência/histórico (ver §13) |
| Autenticação cliente | **Supabase Auth** (passwordless: magic link + Google OAuth) |
| Autenticação admin | Cookie HMAC próprio (`lib/admin-auth`) |
| Pagamentos | **Mercado Pago** (Checkout Bricks + API de pagamentos) |
| E-mails | **Resend** (domínio verificado, DKIM/SPF) |
| Armazenamento de arquivos | **Supabase Storage** (buckets) |
| Letra por IA | **Google Gemini** (`@google/genai`, AI Studio API key) |
| Música por IA | **KIE.ai** (agregador, gera via modelo Suno) |
| Título automático da música | Gemini (`lib/composer/title.ts`) |
| Carrossel/player | **Swiper.js 12** |
| QR Code | `qrcode` / `qrcode.react` |
| Validação | `zod` |
| Automação | **n8n Cloud** (webhooks de eventos → WhatsApp, futuro) |
| Observabilidade | **Sentry** (`@sentry/nextjs`) |
| CI | GitHub Actions (`next build` a cada push/PR) |

---

## 3. Hospedagem, região e infraestrutura

- **Aplicação (frontend + APIs):** **Vercel** (projeto `fizmusica`), plano Hobby.
- **Banco de dados + Auth + Storage:** **Supabase** (projeto `esjjcqwxcflppyqrixqt`), AWS us-west-1 (Oregon, EUA).
- **E-mail:** Resend, domínio `fizmusica.com.br`.
- **Deploy:** **GitHub é a fonte da verdade** — commit + push em `main` dispara auto-deploy na Vercel. `vercel --prod` (CLI) só em emergência ([feedback_deploy_via_github]). Tags `estavel-YYYY-MM-DD` marcam pontos de restauração (ex. `estavel-2026-07-01`). Rollback: "Promote to Production" no dashboard da Vercel, ou `git revert`/checkout de tag + push.
- **Cron:** `vercel.json` agenda `/api/cron/recovery` 1x/dia (limite do plano Hobby) — faz repescagem multi-toque, expurgo de fotos/lead não pago, expurgo das sessões do wizard e expurgo de fotos de pedido pago quando o link expira. **A repescagem e o expurgo são independentes dentro da rota:** o expurgo roda mesmo em dia sem carrinho abandonado (e mesmo se a busca de pedidos falhar). Já foi diferente — até 2026-08-17 a rota saía com `return` quando não havia pedido pra repescar, e o expurgo LGPD só acontecia em dia que tivesse e-mail pra enviar.
- **Node:** versão 22 fixada em `.nvmrc` (mesma do CI).
- **Conexão direta ao banco (`DATABASE_URL`/`DIRECT_URL`) não é alcançável** nem da máquina local nem da Vercel — o host é IPv6-only. Migrações SQL novas são aplicadas manualmente no **SQL Editor do Supabase**; verificação pós-migração via REST (`/rest/v1/<tabela>?select=<col>&limit=1` com service role → 200 se a coluna existe).

> **Residência de dados:** banco, contas e arquivos (incl. fotos de clientes) ficam nos **EUA** (Supabase/AWS us-west-1) — relevante para a Política de Privacidade (transferência internacional, LGPD art. 33).

---

## 4. Arquitetura

- **App Router**: páginas (`page.tsx`) e APIs (`route.ts`) em `app/`.
- **Dois clients Supabase** (`lib/supabase.ts`):
  - `supabase` (anon key) → só usado no **navegador** para `supabase.auth.*` (login). Não faz queries `.from()` — todo acesso a dado é server-side.
  - `createServerClient()` (service_role key, ignora RLS) → usado em **todas** as APIs/Server Components. Se a env var faltar, lança erro explícito (não cai silenciosamente pro anon — ver §11).
- **Proxy/Middleware** (`proxy.ts`): protege `/admin/*` por cookie admin. APIs `/api/admin/*` revalidam o cookie internamente (`verifyAdminToken`), pois o proxy não cobre `/api/*`.
- **Padrão recorrente "trigger → webhook → ingest → storage"**: usado pela integração Suno/KIE (e planejado para o futuro Teaser Premium). Sempre com resposta rápida ao webhook + processamento em `after()` (background).
- **Padrão "helper em `lib/`, chamado de todos os pontos de transição, idempotente"**: usado em `ensurePaymentPrep` (e-mail pós-pagamento), `notifyMusicReady` (aviso de música pronta), `logOrderEvent` (auditoria) — necessário porque a entrega tem **dois caminhos** (manual antigo + fluxo Suno novo) e automações que só ficam no caminho antigo quebram silenciosamente (ver §9.5).
- **Serviços** (`app/services/`): `emailService` (Resend, todos os templates num único `emailShell`), `orderService` (criação de pedido + webhook n8n).
- **Libs relevantes** (`lib/`): `admin-auth`, `imageValidation`, `paymentAlerts`, `date.ts` (helpers de data — ver §11), `orderEvents.ts` (auditoria), `revision.ts` (duplicação de pedido em revisão), `composer/` (letra por IA), `suno/` (música por IA), `payments/prep.ts` (`ensurePaymentPrep`).

---

## 5. Banco de dados — tabelas e dados do cliente

### `orders` (pedido)
- **nome, email, whatsapp** (PII)
- context, subcategory, musicalStyle, voiceType, emotion
- **honoreeName** (PII de terceiro), honoree_consent
- **Envio físico** (produto físico ainda não existe, mas colunas já preparadas): shipping_name, shipping_cep, shipping_address, shipping_number, shipping_complement, shipping_neighborhood, shipping_city, shipping_state, shipping_phone
- productId, deliveryOptionId, status (`PENDING`/`IN_PRODUCTION`/`DELIVERED`/`ABANDONED`), paymentStatus, photo_effect
- **photo_token** (uuid, acesso sem login às fotos pré-pagamento), **userId** (conta vinculada)
- `lyricsDraft`, `lyricsApproved`, `lyricsApprovedAt`, `lyricsReprocessCount` (fluxo de letra por IA)
- `sunoTaskId`, `sunoStatus` (`null`/`GENERATING`/`READY`/`RELEASED`/`FAILED`), `sunoError`, `sunoTracks` (jsonb)
- `is_revision`, `parent_order_id`, `revision_note` (fluxo de revisão)
- `sharing_term_accepted_at`, `sharing_term_version` (Termo de Entrega Digital)
- `publication_consent` (autorização de publicação — Catálogo)
- `terms_accepted_at`, `terms_version`
- `customer_ip`, `customer_state` (estimativa aproximada de estado por IP — ver §11)
- createdAt, updatedAt

### `order_answers` (respostas do wizard)
question, **answer** (texto livre — pode conter dado sensível), position, context, subcategory.

### `payments`
amount, status, **mpPaymentId**, mpPreferenceId, mpStatus, paidAt, `payer_email`, `productId`/`deliveryOptionId` (reconciliação — ver §8). **Relacionamento 1:1 com `orders` (FK `orderId` unique) — mas o Supabase/PostgREST embute como ARRAY mesmo assim** (`payments(...)` no `.select()` vira `[{...}]`, nunca objeto sozinho). Todo consumidor deve indexar `[0]` ou a API deve normalizar antes de responder — normalizado hoje em `/api/orders` e `/api/orders/[id]` ([feedback_payments_array_supabase]).

### `generated_music`
musicName, **personName**, lyrics, lyricsLrc, mp3Url, imageUrl, slug, views, `publishedAt`, `link_disabled_at` (expurgo de link — nunca apaga o MP3/letra, só marca desativado).

### `order_photos`
**url, storage_path** (fotos de pessoas reais — dado pessoal sensível), is_cover, sort_order, created_at. Capa é **sempre** a imagem gerada pela Suno (não uma foto do cliente) — ver §9.4.

### `order_claims`, `wizard_sessions`, `feedbacks`, `payment_alerts`, `revision_requests`, `order_events`, `purge_settings`, `purge_log`, `coupons`, `composer_settings`
Ver seções específicas (§8 pagamentos, §9 Suno, §10 letra, §12 LGPD/cupons, §14 auditoria).

### Wizard configurável (admin)
`wizard_occasions`, `wizard_subcategories`, `wizard_questions`, `wizard_question_options`, `products`, `product_delivery_options` (produto tem `photo_limit`, padrão 10).

### Supabase Auth (`auth.users`)
e-mail de login; via Google: nome e foto de perfil (user_metadata), provedor.

### Supabase Storage (buckets, todos `public=true`)
`order-photos` (fotos dos clientes + capa gerada pela IA), `product-images`, `songs` (MP3 das músicas).

---

## 6. Jornadas

### 6.1 Jornada do cliente (fluxo atual, pós-automação da Suno)

1. **Home** (`/`) → **Criar** (`/criar`): wizard com recuperação por `orderId` (não só localStorage — ver §6.3).
2. **Produtos** (`/produtos`): produto + prazo (ou dados de envio se físico), cupom (banner público ou digitado).
3. **Checkout** (`/checkout`): Mercado Pago Bricks. PIX mostra QR na tela e confirma sozinho (polling).
4. **Preparo** (`/preparar/[token]`, sem login, ou dentro de `/minha-musica` já logado): mini-funil guiado **Letra → Fotos → Aprovar & gerar**. A letra (gerada por Gemini a partir das respostas do wizard) é editável; o cliente pode pedir até 3 reprocessamentos por IA. Fotos são um **gate** (confirma ou pula explicitamente), mas não bloqueiam o fluxo. Aviso de irreversibilidade antes de aprovar: **depois de aprovar, nem letra nem fotos podem mais ser alteradas** (é nesse texto que houve uma correção — antes dizia algo que não era verdade sobre poder editar depois).
5. **Aprovação da letra dispara a geração da música** automaticamente (modo "auto"/"review" no admin; modo "manual" não dispara e aguarda o admin gerar/subir).
6. **Escolha da versão** (`/minha-musica`): quando a Suno libera (ou o admin libera manualmente), o cliente escolhe a versão principal entre as ~2 geradas — pode trocar depois. Ao escolher, o pedido vira `DELIVERED`.
7. **Termo de Entrega Digital**: antes de ouvir/baixar/gerar QR, precisa aceitar o termo (`/legal/entrega-digital`) — responsabilidade de compartilhamento é do cliente.
8. **Player público** (`/m/[slug]`): letra sincronizada (LRC automático), fotos do cliente em carrossel, QR Code.
9. **Avaliação** (`/feedback/[token]`): nota + comentários, enviado ~2h após entrega (cron).
10. **Não gostou?** → `/contestar/[orderId]`: pede revisão (texto livre); aceite pode ser manual (admin) ou automático (`revision_auto_accept`), o que **duplica o pedido** como um novo, pago e em produção, reaproveitando cadastro/fotos/letra antiga — cliente reaprova a letra (ou já pede ajuste específico) pra disparar a nova geração.

### 6.2 Jornada do admin

- **Dashboard** (`/admin`), **Pedidos** (`/admin/pedidos`, busca/filtros + coluna de estado estimado por IP), **Produção** (`/admin/producao`) — fila com cards recolhidos por padrão, destaque "⚠️ Precisa de ação" (revisão pendente / geração falhou / pronta pra liberar), fotos do cliente, efeito, painel Suno (gerar/ouvir/liberar/regenerar), formulário de produção (upload manual).
- **Produtos** (`/admin/produtos`), **Wizard** (`/admin/wizard`), **Compositor IA** (`/admin/compositor` — prompt/modelo/location do Gemini), **Operação** (`/admin/operacao` — modo de produção, expurgo, cupom auto-aceite de revisão), **Catálogo** (`/admin/musicas` — todas as músicas geradas, views, consentimento de publicação, status do link), **CRM** (`/admin/crm` — recuperação, análises com "mais pedidas" + "mais clicadas", avaliações), **Cupons** (`/admin/cupons`), **Logs & Alertas** (`/admin/logs` — duplicidade de pagamento, saldo Suno/KIE, consumo de Storage).
- Prévia "👁 Simular player" antes de entregar (`/admin/producao/preview/[orderId]`).

### 6.3 Recuperação de pedido

Fonte da verdade é o **`orderId`** (não só `localStorage`, que some em navegadores in-app no mobile — ex. link de e-mail abrindo dentro do app do Gmail):
- `/criar?orderId=X` reconstrói o wizard no resumo (busca `GET /api/orders/[id]`); se já pago, redireciona pra `/minha-musica`.
- `/produtos` "Voltar" preserva `orderId`.
- Banner na home (`ResumeMusicBanner`) aparece se há sessão local.
- E-mail de recuperação (cron, pedidos UNPAID 4h–7d) aponta pra `/criar?orderId=X` (cross-device).

---

## 7. Rotas (resumo)

### 7.1 Páginas públicas
`/`, `/criar`, `/produtos`, `/checkout`, `/sucesso`, `/entrar`, `/auth/callback`, `/minha-musica`, `/pedido/[token]/fotos`, `/preparar/[token]`, `/contestar/[orderId]`, `/m/[slug]`, `/feedback/[token]`, `/legal`, `/legal/[slug]`, `/quem-somos`, `/contato`, `/health`.

### 7.2 Páginas admin (protegidas por `proxy.ts`)
`/admin`, `/admin/login`, `/admin/pedidos(/[id])`, `/admin/producao(/preview/[orderId])`, `/admin/produtos`, `/admin/wizard(/[occasionId]/[subcategoryId])`, `/admin/compositor`, `/admin/operacao`, `/admin/musicas`, `/admin/crm`, `/admin/cupons`, `/admin/logs`.

### 7.3 APIs principais

**Pedidos/jornada:** `POST/GET /api/orders`, `GET/PATCH /api/orders/[id]`, `GET /api/orders/[id]/status`, `POST /api/orders/[id]/fotos`, `POST /api/orders/[id]/contestar`, `POST /api/orders/[id]/aceitar-entrega`, `GET/PUT /api/wizard-session`, `GET /api/wizard`, `GET /api/produtos`, `GET /api/preparar/[token]`.

**Letra por IA:** `GET/POST /api/orders/[id]/letra`, `POST /api/orders/[id]/letra/gerar`, `POST /api/orders/[id]/letra/reprocessar`, `POST /api/orders/[id]/letra/aprovar`.

**Música por IA:** `POST /api/suno/callback` (webhook KIE), `POST /api/orders/[id]/musica/escolher`, `GET /api/orders/[id]/musica/download`, `POST /api/admin/producao/[id]/suno` (ações: gerar/regenerar/liberar/sincronizar).

**Pagamentos:** `POST /api/payments/create`, `POST /api/payments/confirm`, `POST /api/payments/webhook`, `GET /api/payments/status`, `POST /api/payments/free` (pedido zerado por cupom 100% — ver §12.3).

**Cupons:** `POST /api/coupons/validate` (preview); relatório/lista em `GET /api/admin/cupons`.

**Conta/vínculo:** `POST /api/conta/claim`, `GET /api/conta/claim/confirm`, `GET/POST /api/conta/link-order`.

**Fotos:** `/api/pedido/[token]/fotos`, `/api/admin/pedidos/[id]/fotos`.

**Feedback:** `GET/POST /api/feedback/[token]`.

**Admin:** `/api/admin/auth`, `/api/admin/produtos/*`, `/api/admin/wizard/*`, `/api/admin/producao/[id]` (+ `/entregar`, `/upload-url`, `/aceitar-revisao`), `/api/admin/pedidos/[id]`, `/api/admin/payments/sync`, `/api/admin/payment-alerts/[id]`, `/api/admin/crm/*`, `/api/admin/compositor`, `/api/admin/operacao/purge`.

**Automação:** `GET /api/cron/recovery` (repescagem + expurgo), `GET /api/cron/feedback-emails`.

---

## 8. Pagamentos (Mercado Pago)

- **Checkout Bricks** no `/checkout`, cartão/PIX/boleto, parcelamento até 12x.
- **PIX na tela:** QR + copia-e-cola vêm na resposta do pagamento; polling (`/api/payments/status`) confirma sem sair da tela.
- **Vínculo pagamento↔pedido:** `external_reference = orderId`.
- **Anti-duplo-pagamento (3 camadas, 2026-06-16):**
  1. `payments/create` recusa (`409 alreadyPaid`) se o pedido já está `PAID`.
  2. Checkout, ao abrir, verifica o pedido e redireciona pra `/sucesso` se já pago.
  3. **Alerta de duplicidade** (`lib/paymentAlerts.ts`): se chegar um pagamento aprovado com `mpPaymentId` diferente do já registrado, grava em `payment_alerts`, avisa por e-mail, **não sobrescreve** o pagamento original. Tela `/admin/logs`.
- **Integridade produto/valor (2026-06-19)** — bug de "tela desatualizada" (cliente volta com bfcache, troca de produto, paga — pedido saía errado):
  1. `payments/create` **ignora preço vindo do cliente**, busca `products.price` no banco (server-authoritative); recebe `productId`, não `price`.
  2. Antes de gerar novo PIX, **cancela o PIX pendente anterior** (nunca existem 2 QRs pagáveis simultâneos).
  3. `payments.productId`/`deliveryOptionId` guardam o produto DAQUELE pagamento específico; na aprovação, o **pedido reconcilia** com o que foi realmente pago.
- **Valor exibido considera entrega + cupom** — bug corrigido 2026-07-05: `payments` chega como array do Supabase (ver §5); telas que faziam `.payments?.amount` sem `[0]` mostravam preço errado ou nem mostravam. Corrigido normalizando na API (`/api/orders` e `/api/orders/[id]`).
- Idempotency key do MP **não implementada de propósito** (fecharia a janela de corrida, mas atrapalharia retry de pagamento recusado).

---

## 9. Música por IA — Suno via KIE.ai

Maior integração do projeto. Provedor: **KIE.ai** (agregador multi-modelo, mais estável que wrapper direto da Suno), gera via modelo Suno v5, sem marca d'água, uso comercial autorizado por escrito.

### 9.1 Fluxo automático

1. Cliente aprova a letra (`POST /api/orders/[id]/letra/aprovar`) → `orders.status` vira `IN_PRODUCTION` **nesse exato momento** (independe do Suno funcionar ou não).
2. Se o modo de produção (`composer_settings.suno_mode`) não é `manual`, dispara `triggerSunoGeneration` em background (`after()`) — chama `POST https://api.kie.ai/api/v1/generate` (prompt = letra aprovada, style = estilo+emoção, vocalGender ← voiceType, title, callBackUrl, model padrão V5). Retorna `taskId`; `sunoStatus` vira `GENERATING`.
3. KIE processa (~1min) e chama o **webhook** `POST /api/suno/callback` com as faixas (2 versões geralmente). `lib/suno/ingest.ts` (`ingestSunoResult`) baixa os MP3s pro bucket `songs`, gera **LRC sincronizado automático** (via endpoint `get-timestamped-lyrics`, agrupando palavras por linha), define título/homenageado automáticos (Gemini, só se ainda vazio), baixa a **capa gerada pela IA** e a define como capa do pedido (nunca uma foto do cliente).
4. `sunoStatus` vira `RELEASED` (modo `auto` — libera direto pro cliente) ou `READY` (modo `review`/`manual` — aguarda o admin clicar "Liberar versões" no painel de Produção).
5. Cliente escolhe a versão principal (`POST /api/orders/[id]/musica/escolher`) → `orders.status` vira `DELIVERED`. Pode trocar a principal depois (idempotente).
6. **Fallback de polling**: se o webhook falhar/atrasar, botão "🔄 Sincronizar" (e auto-poll a cada 12s enquanto `GENERATING`) consulta `record-info` na KIE e processa do mesmo jeito (`ingestSunoResult` é reutilizado).

### 9.2 Duas camadas de status — não confundir

| Camada | Onde | Valores |
|---|---|---|
| **Etapa do pedido** (`orders.status`) | Abas no topo de `/admin/producao` | `PENDING` (Aguardando) / `IN_PRODUCTION` (Em produção) / `DELIVERED` (Entregue) |
| **Estado da música** (`orders.sunoStatus`) | Painel "Música por IA" dentro do pedido | `null` / `GENERATING` / `READY` / `RELEASED` / `FAILED` |

O clique em "Gerar" **não** move a etapa do pedido. O que move é aprovar a letra (→ Em produção) e a escolha/liberação da versão (→ Entregue). Um pedido pode estar "Em produção" com a música já "Pronta p/ liberar" — são independentes por design ([project_fizmusica_status_producao]).

### 9.3 Se der erro ou demorar

- **Falha do Suno** (qualquer momento): só `sunoStatus` vira `FAILED` com o motivo real do erro — **`orders.status` NÃO volta pra "Aguardando"**, continua "Em produção". Não há retry automático; precisa clique manual em "🔁 Gerar novamente". Mesma lógica pra revisão automática: o pedido de revisão já nasce "Em produção", só avança de verdade quando a letra é reaprovada.
- **Resposta tardia da API**: coberta por webhook (a qualquer momento) OU pelo botão/poll de sincronização — ambos convergem pro mesmo processamento (`ingestSunoResult`).

### 9.4 Regras de produto definidas ao longo do projeto

- **Ambas as versões ficam disponíveis** pro cliente (não é "admin escolhe 1") — o cliente escolhe e pode trocar depois.
- **Capa é sempre a imagem da IA**, nunca foto do cliente — fotos do cliente aparecem só no carrossel do player.
- **Fotos são gate, não bloqueio**: cliente precisa confirmar ou pular explicitamente antes de aprovar a letra, porque depois de aprovar nada mais pode ser alterado (gate de irreversibilidade).
- **3 modos de produção** (`composer_settings.suno_mode`, admin → Operação): `auto` (libera sozinho e avisa o cliente), `review` (gera mas espera admin liberar), `manual` (não dispara nada — admin gera manualmente ou sobe MP3).
- **Revisão reabre editável**: aceitar a revisão duplica o pedido com `lyricsApproved=false` e NÃO dispara a Suno — só quando o cliente reaprova (podendo aplicar a instrução da revisão, ex. "voz feminina", "mais lenta").
- **Segurança de download**: endpoint próprio (`/api/orders/[id]/musica/download`) entrega o MP3 com nome de arquivo amigável e **remove tags ID3** que expunham `suno.com/song/<id>` nos metadados do arquivo cru.
- **Fallback manual preservado**: conta oficial da Suno (Pro/Premier) continua disponível pro admin subir manualmente em casos sensíveis/publicação — a integração KIE é aditiva, não substitui.

### 9.5 Entrega tem dois caminhos — armadilha recorrente

Toda automação de "pedido pronto/entregue" (e-mail, cupom de fidelidade, criação da linha de feedback) precisa rodar em **ambos** os caminhos: o antigo manual (`POST /api/admin/producao/[id]/entregar`) e o novo da Suno (liberação automática ou escolha de versão). Já quebrou 3 vezes por esquecer um dos dois: e-mail de música pronta, e-mail de feedback, cupom de fidelidade — todos corrigidos extraindo a lógica pra um helper em `lib/` chamado nos dois pontos, sempre idempotente ([project_fizmusica_entrega_dois_caminhos]).

---

## 10. Letra por IA (Gemini)

- Gerada a partir do contexto do pedido (respostas do wizard) via `lib/composer/gemini.ts` (`generateLyrics`/`generateLyricsStream`, streaming em tempo real na tela do cliente).
- Autenticação: `GEMINI_API_KEY` (AI Studio) — **não** Vertex AI (política da organização bloqueia download de chave de service account). Chave precisa estar em modo "Paid" (créditos pré-pagos, não basta ter billing só no projeto GCP).
- Modelo configurável em `/admin/compositor` (prompt, modelo, location) — `composer_settings`, com prompt-seed default caso a tabela esteja vazia.
- Cliente pode gerar, editar manualmente, e pedir até **3 reprocessamentos por IA** antes de aprovar.
- Aprovação é o gatilho da geração musical (ver §9.1) e trava a letra (não editável depois).
- Custo ≈ R$0,01/letra.

---

## 11. Datas, geolocalização e outras particularidades técnicas

- **Fuso horário:** colunas `timestamp without time zone` no banco (ex. `orders.createdAt`) vêm sem `Z` no JSON — em componentes client (`"use client"`, rodando no fuso do navegador), `new Date(...)` interpretaria como hora local errada (~3h de diferença). Sempre usar os helpers de `lib/date.ts` (`fmtDateBR`, `fmtTimeBR`, `fmtDateTimeBR`, `dbTime`) ao exibir data do banco — nunca `new Date(valorDoBanco)` direto.
- **Estimativa de estado por IP:** `orders.customer_ip`/`customer_state` — capturado na criação do pedido, geolocalizado em background via ip-api.com (gratuito, sem chave). É uma **estimativa aproximada** (faixa de IP do provedor, não endereço) — declarada na Política de Privacidade como finalidade nova de um dado já coletado (IP já era logado por segurança).
- **Payments como array:** ver §5 e §8 — relacionamento 1:1 do Supabase sempre chega como array no embed do PostgREST, nunca normaliza sozinho.
- **Grandfathering de gates novos:** ao adicionar um gate/filtro sobre uma coluna nova (ex. o gate de `lyricsApproved` na fila de Produção), sempre fazer uma migração de dados retroativa nos registros legados — já aconteceu de 19 pedidos pagos anteriores à feature sumirem da fila por ficarem com o valor default da coluna nova.

---

## 12. LGPD, expurgo, cupons e Catálogo

### 12.1 Expurgo (retenção de dados)
- **Fotos/lead de pedido NÃO pago:** expurgo automático (cron diário) — fotos (obrigatório LGPD, imagem de terceiro sem compra) e lead (interesse legítimo, prazo declarado). Os prazos são parametrizáveis em `/admin/operacao` (`purge_settings`); em produção hoje: `photos_days = 15`, `lead_days = 15` — unificados de propósito (2026-08-23): apagar só a foto e deixar o cadastro do pedido vivo por mais tempo não fazia sentido. Relatório em `purge_log` — **linha por execução, inclusive execução que não apagou nada**, e é isso que dá pra usar como sinal de saúde: buraco de dias no log significa que o cron não rodou.
- **Sessões do wizard** (`wizard_sessions`, jornada sem login): apagadas pelo **mesmo `lead_days`** dos pedidos — de propósito, porque dois prazos separados poderiam divergir e a história sobreviveria ao pedido que ela duplica. Guardam respostas, dados de contato e a letra da prévia, então são dado pessoal como qualquer outro. Efeito colateral assumido: link de recuperação `/criar?sessao=…` com mais de 15 dias deixa de funcionar. O contador de prévias por IP (`preview_rate_limit`, único derivado de IP do sistema) é limpo aos 7 dias.
- **Pedido PAGO nunca expurga por completo** (CDC/fiscal, 5 anos).
- **MP3/letra NUNCA são apagados**, mesmo quando o link expira — a Licença de Uso já garante à empresa o direito de reter a obra ("propriedade exclusiva", pode integrar "playlists e catálogos musicais"), independente de opt-in. O que existia antes (apagar o MP3 "em definitivo") contradizia esse direito.
- **Quando o link expira** (`music_enabled`/`music_days`, painel Operação): `generated_music.link_disabled_at` é marcado (não apaga nada) e, **no mesmo evento**, as **fotos do pedido são removidas** (arquivo + linha, capa da IA inclusa) — decisão foi "mesmo evento", não "mesmo prazo", porque fotos (imagem de pessoa real) são tratadas de forma mais sensível que a obra musical nos termos legais.
- Link desativado mostra tela "não está mais disponível" (não 404 cru) em `/m/[slug]`.

### 12.2 Autorização de publicação
- Cliente opta (`orders.publication_consent`) se autoriza a música ser publicada em catálogo/playlist futura. Com opt-in, a obra pode ser divulgada com nomes/história reais tal como na letra (sem precisar anonimizar). **Nunca revela quem pagou, nunca usa fotos do cliente**, mesmo com opt-in.
- **Catálogo** (`/admin/musicas`): lista todas as músicas geradas (link ativo ou desativado) com views, consentimento de publicação, código do pedido — decisão manual futura de curadoria de playlist, não automática.

### 12.3 Cupons
- Tabela `coupons` (código, tipo %/valor, valor mínimo, limite de usos, validade, ativo).
- Aparecem em 4 jornadas: e-mail de repescagem dia-3 (auto-aplica via link), campo no checkout, banner público em `/produtos`, cupom de fidelidade pós-entrega.
- **Cupom público não se auto-aplica** — só desconta se o cliente digitar/aplicar manualmente (correção feita após bug de auto-aplicação indevida).
- Validação de preview via `/api/coupons/validate`; autoridade final é sempre o `checkout/create`, que revalida.
- **Atribuição por pedido:** ao criar a cobrança, `orders.coupon_code` + `orders.discount_amount` são gravados (todos os métodos, inclusive PIX). É a base do relatório e da contagem de usos.
- **Usos = pedidos PAGOS com aquele `coupon_code` (derivado, não contador).** Antes existia `coupons.used_count` incrementado só no cartão aprovado na hora — PIX (confirm + webhook) nunca contava, e em produção o EUQUERO tinha 6 conversões reais aparecendo como 0. Correção 2026-07-11: `countCouponUses()` em `lib/coupons.ts` conta `orders` PAGOS com o código; `checkCouponActive`/`getActivePublicCoupon` e o limite `max_uses` passam a usar isso. O campo `used_count` no banco ficou **obsoleto** (não é mais lido nem escrito). A tela `/admin/cupons` recebe o valor derivado pela API.
- **Relatório de conversão por cupom** (`/admin/cupons`, `GET /api/admin/cupons`): por cupom mostra vendas pagas, receita, desconto concedido e testes grátis (R$ 0), derivado de `orders` PAGOS + `payments`. Serve pra **comissão de influenciador/youtuber** — um código único por youtuber (`JOAO20`) faz cada linha ser a conversão dele.
- **Cupom que zera o total (100%) → caminho "pedido grátis":** o Mercado Pago não cobra R$ 0. Quando um cupom válido zera o total, o checkout troca o Brick do MP por um botão "Concluir pedido grátis" → `POST /api/payments/free`. O endpoint revalida o cupom no servidor, exige `finalTotal === 0`, marca o pedido PAGO, registra `payments` de R$ 0 (`mpPaymentId = FREE-<orderId>`, vira "teste grátis" no relatório) e roda `ensurePaymentPrep` (idempotente). Quantidade de testes é controlada pelo `max_uses` do cupom. Uso pensado: youtuber testar a plataforma antes de fechar parceria.

---

## 13. Banco de dados — nota sobre Prisma

`prisma/schema.prisma` e `prisma/migrations/*.sql` existem só como **referência/documentação** — não há `PrismaClient` nem `pg` client rodando em runtime em lugar nenhum do código. Toda leitura/escrita é via `@supabase/supabase-js`. Migrações novas: escrever o `.sql`, aplicar manualmente no SQL Editor do Supabase, verificar via REST antes de subir código dependente (ver §3).

---

## 14. Auditoria (histórico de ações do pedido)

Tabela `order_events` (append-only): `orderId, type, detail, actor ('cliente'|'admin'|'system'), created_at`, via helper `lib/orderEvents.ts` (nunca quebra o fluxo principal se falhar). 13 pontos instrumentados: pedido criado, pagamento confirmado, letra aprovada/reprocessada, foto enviada/removida, capa definida, termo de entrega aceito, revisão solicitada/aceita, versão principal alterada, música gerada/liberada. Exibido em "📜 Histórico do pedido" em `/admin/pedidos/[id]` — serve de respaldo em caso de contestação.

Motivo de existir: campos como `lyricsApprovedAt` só guardam o estado **atual** — se o cliente reprocessar a letra várias vezes ou trocar a versão principal, o banco sobrescreve sem rastro do "antes". `order_status_history` (tabela antiga do schema) nunca foi usada — esqueleto morto, substituído por `order_events`.

---

## 15. Autenticação

### Cliente — passwordless (Supabase Auth)
Link mágico (`signInWithOtp`) e Google (`signInWithOAuth`). `/auth/callback` é página client (não `route.ts`) que chama `verifyOtp` no navegador — rota server não propagava a sessão. `AuthHashHandler` (layout raiz) captura o token em qualquer página (fluxo implícito pode cair na home) e redireciona pra `/minha-musica`.

### Admin — cookie HMAC próprio
Senha (`ADMIN_PASSWORD`) → token assinado HMAC-SHA256, cookie httpOnly 7 dias. `proxy.ts` protege `/admin/*`; `/api/admin/*` revalida internamente.

### Quem pode criar conta (e o risco que isso trouxe)
Desde a abertura da área ao visitante, **conta sem compra é legítima** — quem quer guardar favoritos na Rede precisa de uma. O `/entrar` não recusa mais e-mail sem pedido.

A checagem de pedido (`/api/conta/check-email`) continua existindo, mas mudou de papel: não é barreira, é **detector de erro de digitação**. Quem escreve `gmial` receberia o link normalmente, criaria uma segunda conta vazia e acharia que perdeu as músicas. Por isso o aviso aparece **antes de qualquer e-mail sair**, o botão de enviar fica desabilitado enquanto ele está na tela, e prosseguir exige um segundo clique em "Criar minha conta"; corrigir o e-mail refaz a checagem.

⚠️ **Atenção operacional:** o volume de e-mail para endereços desconhecidos deixou de ser zero. O domínio é jovem e já esteve na caixa de spam. Se a entrega dos transacionais piorar, este é o primeiro lugar a investigar — freios possíveis, do mais barato ao mais drástico: captcha só no caminho "criar conta", limite por IP no `check-email`, ou voltar a exigir pedido (e então trocar os convites de favoritar por "Criar minha música"). Nota: o login com Google nunca teve essa trava — a assimetria entre os dois botões foi o que motivou a mudança.

### Vínculo de pedido à conta
Mesmo e-mail → automático. E-mail diferente e pedido recente (<24h, não vinculado) → popup na área linka e iguala o e-mail (jornada recém-paga já é a prova). E-mail diferente em geral → reivindicação confirmada por e-mail de compra. E-mail com erro de digitação → admin corrige no detalhe do pedido (bloqueado após `PAID`, evita sequestro de pedido por quem souber o `orderId`).

---

## 16. Segurança

- **RLS (Row Level Security) habilitado em todas as tabelas** (`public` schema) desde 2026-06-23, sem policies de leitura pública onde não precisa — como todo acesso sensível já era via `service_role` (que ignora RLS), habilitar RLS sem policy simplesmente bloqueia 100% do acesso anônimo/autenticado direto ao Supabase REST, sem quebrar o app. Exceções com `public read` mantidas de propósito (catálogo inofensivo): `products`, `wizard_*`.
- **Storage:** policies de leitura/escrita pública removidas dos buckets (upload sempre via `service_role` ou signed URL); bucket é `public=true` só pra servir arquivo via `getPublicUrl`, não pra listar/gravar.
- **Funções com `search_path` fixado** (`set_updated_at`, `increment_coupon_use`, `increment_music_views`) — corrige warning "Function Search Path Mutable". Obs.: `increment_coupon_use` ficou **obsoleta** desde 2026-07-11 (usos de cupom agora são derivados, ver §12.3) — a função ainda existe no banco mas não é mais chamada.
- **Upload de fotos defensivo** (`lib/imageValidation`): validação por magic bytes (assinatura real do arquivo), só JPEG/PNG/WebP (sem SVG, evita XSS), nome aleatório no servidor (sem path traversal). Limite de fotos por pedido parametrizável por produto (`photo_limit`, padrão 10).
- **Anti-hijack de e-mail:** `PATCH /api/orders/[id]` bloqueia troca de e-mail depois de `PAID`.
- **Fallback de `createServerClient()` removido**: antes caía pro anon key se a service role faltasse (silenciosamente mostraria telas vazias); agora lança erro explícito.
- **Pendências de segurança:** CSP (Content-Security-Policy) ainda não configurado — cuidado ao implementar, pode quebrar o Brick do Mercado Pago (carrega scripts/iframes de múltiplos domínios).

---

## 17. Observabilidade e deploy

- **Sentry ativo** (`@sentry/nextjs`), configs de server/edge/client, `sendDefaultPii:false`, Session Replay desligado, source maps habilitados (via `SENTRY_AUTH_TOKEN` na Vercel) — stack traces legíveis, release atrelado ao commit.
- **CI** (GitHub Actions, `.github/workflows/ci.yml`): roda `next build` a cada push/PR pra `main`, com env vars fake só pra permitir a construção dos clients (Supabase/Resend/MP são instanciados no carregamento do módulo e quebrariam sem env — build não faz request de rede real).
- **Deploy = GitHub → Vercel** (ver §3). Rotina no fim de cada sessão de trabalho: revisar erros novos no Sentry, verificar se o build passou, priorizar por impacto (🔴 pagamento/login/banco/500 > 🟠 wizard/upload/player > 🟡 layout/performance > 🟢 visual).

---

## 17.1 Performance, custo e crescimento (análise de 2026-08-28)

Levantamento feito a pedido do Audrei, com números medidos em produção — não estimados.

**Como o conteúdo é servido hoje.** Cloudflare está na frente do **Vercel** (HTML/JS). O **áudio não passa por ele**: os MP3 saem direto do Supabase Storage, que tem CDN próprio (também Cloudflare). Funciona, mas essa camada não é controlada por nós.

**Resolvido nesta rodada:**
- **Capas eram link externo que expira** (`fd6776a`) — o ingest baixava o áudio pro nosso bucket mas guardava a capa apontando pra `musicfile.kie.ai` / `tempfile.aiquickdraw.com`. Não era lentidão, era **perda de dado**: 2 capas já tinham morrido (viraram quadrado preto). 104 resgatadas via `scripts/backfill-capas.mjs`; as 2 perdidas viraram `null` (caem no gradiente da marca).
- **Catálogo sem cache** (`722f80c`) — a rota era `force-dynamic` e cada visitante disparava 4 consultas + montagem completa. Agora a parte compartilhada é cacheada 60s em memória e só a personalização (favorito, slug, apelido próprio) roda por requisição.

- **Letra viajava na listagem** (`7444f42`) — eram 76% do payload e a lista não usa letra. Agora sai por `/api/catalog/letra?orderId=` só quando o player vai tocar. Medido: **150.219 → 37.800 bytes (75% menor)**; projeção para 5.000 músicas caiu de ~9,7 MB para ~2,7 MB. A trava de publicação é repetida na rota nova de propósito — ela é acessível direto por URL.

**Pendências, em ordem de impacto:**

1. **Sem paginação.** O `select` do catálogo não tem `limit` — retorna tudo. Cuidado ao implementar: as pílulas de ocasião/estilo contam sobre a lista completa no cliente, então paginar exige devolver as contagens agregadas pelo servidor, senão a pílula promete um número e a lista entrega outro (erro que já aconteceu uma vez, ver `78faf4d`).
2. **`cache-control: no-cache` nos arquivos do Storage.** O `cacheControl` de 1 ano passou a ser gravado no upload e o metadata guarda certo (`max-age=31536000`, conferido), mas o Supabase **serve `no-cache` mesmo assim** — aparenta ser limite de plano/Smart CDN, não do código. O CDN ainda cacheia (`cf-cache-status: REVALIDATED`), então a banda está protegida; o custo é uma revalidação por play. Para resolver de verdade: plano do Supabase com Smart CDN, ou pôr o nosso Cloudflare na frente do Storage.

**Referência de escala (como o Spotify resolve):** catálogo cacheado em vez de recalculado (item 2 aqui, já feito), nada carregado inteiro (itens 1 e 2 pendentes) e áudio fragmentado servido de CDN próximo ao ouvinte — este último é exagero para o volume atual.

---

## 18. Design system e padrões de UX (referência rápida)

- **Premissa: toda página nova leva `<Header />` e `<Footer />`** (pedido do Audrei, 2026-08-28, depois de uma auditoria achar `/contestar/[orderId]` com Header mas sem Footer — corrigido no commit `70cdff7`). É o padrão de partida; só foge dele quem tiver um motivo de UX deliberado, e esse motivo entra na lista abaixo, não fica implícito:
  - `/m/[slug]` — player público do presente, imersivo de propósito (é a "surpresa").
  - `/auth/callback` — spinner transitório, redireciona sozinho em menos de 1s.
  - `/criar`, `/produtos`, `/checkout` no **mobile** — tela cheia sem distração (ver item de fluxo logo abaixo); no desktop os três têm Header/Footer normais.
  - `/feedback/[token]` — formulário curto de uma tela só, sem navegação pra não distrair de responder.
  - `/teste-qr` — ferramenta interna, não é página de produto.
  Nova exceção precisa do mesmo padrão: nome da página + motivo, registrado aqui.
- **Paleta:** fundo `#07060d`, gradiente de marca `linear-gradient(135deg, #f0196b, #d946ef)` (rosa→roxo), orbs ambiente com blur.
- **Cards com hover flutuante:** `translateY(-10px) scale(1.02)` + sombra rosa intensa + borda `rgba(240,25,107,0.35)`.
- **Mobile "tela cheia" em fluxos** (wizard, produtos, checkout): `fixed inset-0` sem Header/Footer, progresso no topo, botão de ação fixo na base (glass blur). Desktop: `lg:static` com Header/Footer normais. Pelo mesmo motivo, essas três telas **não** ganham a barra de navegação persistente (`BarraHome` — Home/Pedidos/Criar/Músicas/Carreira, presente em Home/Quem somos/Contato/Legal desde 2026-08-27): página institucional convida a pessoa a explorar o site; funil de compra deve minimizar saídas, não oferecer 5 caminhos pra fora dele. Confirmado com o Audrei em 2026-08-28 — decisão consciente, reavaliar caso a caso se o site ganhar novas telas de conversão.
- **Regra firme de posição do botão "Voltar":** no **mobile** fica no **topo**; no **desktop** fica **embaixo**. Aplicar em toda tela nova de fluxo.
- **Links de termos legais abrem na MESMA aba** (não `target="_blank"`) — permite `router.back()`/bfcache preservar o estado da tela de origem.
- **Admin responsivo:** sidebar `hidden lg:flex` desktop, bottom nav fixo mobile (`lg:hidden fixed bottom-0`), tabelas `hidden lg:block` / cards `lg:hidden`.
- **iOS Safari:** `overflow-x: hidden` em `html, body` + `font-size: 16px !important` em inputs (evita zoom automático que quebra o layout). `dvh` em vez de `vh`/`min-h-screen` puro (evita faixa preta no rodapé em iOS).

---

## 19. Como trabalhamos (preferências registradas)

- **"Pensa antes de fazer"**: para features grandes ou que mudam jornada/dado, apresentar o plano/decisões e esperar confirmação antes de codar; construir em fases revisáveis. Mudanças pequenas/óbvias (texto, ajuste visual, fix) podem ir direto.
- **Doc legal por feature**: toda funcionalidade nova que colete/trate dado, mude jornada, pagamento, fotos, compartilhamento ou entrega gera item de backlog pra revisar a documentação legal correspondente (Termos, Privacidade, Licença, Autorização de Publicação).
- **Deploy via GitHub**: commit + push é o padrão; `vercel --prod` só emergência.

---

## 20. Pendências (backlog)

- **Branding do login Google** (subiu de prioridade em 2026-08-27): a tela de consentimento diz "Prosseguir para `esjjcqwxcflppyqrixqt.supabase.co`". Era cosmético enquanto só cliente logava — quem já comprou confia na marca. Com a área aberta ao visitante, quem vê essa tela é um **estranho vindo de anúncio**, e a URL aleatória mata a confiança no pior momento. Correção: (1) grátis — Google Auth Platform → Branding: nome do app "Fiz Música" + logo + domínio autorizado; (2) se o `*.supabase.co` persistir, Supabase Custom Domain (pago) pra o callback virar `auth.fizmusica.com.br`. Ambos são configuração de painel, não código.
- CSP (Content-Security-Policy) — cuidado com o Brick do Mercado Pago.
- Contador de expiração do QR PIX + botão "gerar novo".
- WhatsApp Business Cloud (Meta) + n8n — finalizar workflow.
- Padronizar templates de e-mail do Supabase Auth (hoje "Confirm signup" ainda no default, sem o layout da marca).
- Fase 3 — recorrência/monetização: lembretes de data especial, desconto recorrente, indicação, assinatura/playlist de músicas.
- **Teaser Premium** (planejado, não codado): vídeo vertical 9:16 pra Reels/TikTok como diferencial do plano Premium — arquitetura decidida (template + JSON de cena normalizado, render via API de montagem tipo JSON2Video/Shotstack, ~R$1/render, emojis Google Noto), mas recomendação é validar por teste concierge (vender como add-on manual pra clientes reais e medir se postam) antes de construir o módulo.
- Revisão jurídica final por advogado dos textos legais atualizados (IA na produção, licença, privacidade).

## 21. Publicação nas redes (agentes de conteúdo)

O painel `/admin/conteudo` gera a peça, aprova e publica. Ao aprovar, a mesma história vira **três peças** (Instagram, TikTok, YouTube), ligadas por `derivado_de` — cada uma com texto próprio da rede, reaproveitando o vídeo de graça.

**O que publica sozinho, e por quê o resto não:**

| Rede | Estado | O que falta |
|---|---|---|
| Instagram | ✅ API ativa (Graph API, token de 60 dias no env) | — |
| TikTok | ⚠️ código pronto, aguardando aprovação | Content Posting API aprovada no portal → `TIKTOK_PUBLISH_SCOPE=1` → reconectar a conta |
| YouTube | ❌ manual | OAuth do Google + YouTube Data API |

**TikTok — dois estágios e duas travas.** O Login Kit (aprovado) só autentica; publicar exige a **Content Posting API**, aprovação separada. Duas limitações que não são contornáveis por código:

1. Enquanto o app não passar pela **auditoria** do TikTok, tudo que ele publica fica em **modo privado**, mesmo pedindo `PUBLIC_TO_EVERYONE`. O escopo libera o envio; a auditoria é que libera o público.
2. **Foto** só entra por `PULL_FROM_URL`, que exige verificar a posse do domínio no portal — o arquivo mora no `supabase.co`, domínio que não é nosso. Então **peça de TikTok sem vídeo continua indo à mão**.

O fluxo implementado em `lib/content/publishers/tiktok.ts` segue a ordem obrigatória da doc: `creator_info/query` (é dele que sai a lista de privacidades válidas da conta) → `video/init` (FILE_UPLOAD, pedaço único; o mínimo por chunk é 5 MB e nossos vídeos cabem inteiros) → `PUT` no `upload_url` → `status/fetch` até sair de `PROCESSING_UPLOAD`. As cenas são geradas por IA e a voz é sintética, então o post vai com `is_aigc: true`.

Pedir `video.publish` antes da aprovação faz o TikTok recusar a tela de autorização **inteira** — quebraria até o login que hoje funciona. Por isso o escopo é ligado por `TIKTOK_PUBLISH_SCOPE=1`, não por padrão.

**Tela de publicação do TikTok** (`app/admin/conteudo/PublicarTiktokModal.tsx`): não é capricho de UX — as diretrizes de compartilhamento são parte do App Review e exigem, antes de qualquer post, mostrar de qual conta o vídeo sai, deixar a privacidade ser **escolhida à mão (sem padrão)**, oferecer comentário/dueto/costura **desmarcados**, respeitar o que a conta já bloqueou, coletar a declaração de conteúdo comercial (com os rótulos "Promotional content"/"Paid partnership") e exibir o consentimento ("Music Usage Confirmation", mais "Branded Content Policy" quando for parceria paga). Título pré-preenchido que não dá pra editar é **proibido** — por isso a legenda gerada pela IA vem editável. Parceria paga não pode ser privada. Enquanto o escopo não sai, a tela abre em **modo prévia** (conta real via `user.info.basic`, publicar desativado) — é ela que o vídeo demo do review mostra.

**Dois modos de envio.** Além do Direct Post (`video.publish` + auditoria), existe o **modo caixa de entrada** (`/v2/post/publish/inbox/video/init/`, escopo `video.upload`, habilitado por padrão no produto): o app entrega só o arquivo e a legenda/privacidade/postagem acontecem dentro do TikTok, por você. É o caminho que dá post **público sem esperar auditoria** — a restrição de "cliente não auditado publica privado" vale para o que o APP publica, não para o que você publica no app. Limite: 5 envios pendentes a cada 24h. No painel é o botão `📲 mandar pro app`, e ele **não** marca a peça como publicada: quem registra isso é o `✔️ já postei`, depois que o post existe.

**Onde a API não publica, a tela entrega o material** (`⬇️ arquivo`, `📋 legenda`) e o botão `✔️ já postei` registra o que foi ao ar. Esse registro não é cosmético: o descarte dos ingredientes de vídeo (cenas, narração, trilha) só roda quando a **família inteira** foi publicada — sem ele, o storage cresceria para sempre e o painel mentiria sobre onde a história está.

---

---

*Documento reescrito a partir da memória consolidada do projeto (32 registros) + inspeção do código-fonte em 2026-07-08. Para detalhes de implementação, consulte os arquivos citados (`app/`, `lib/`, `prisma/migrations/`) — este documento descreve o "porquê" e as decisões; o código é sempre a fonte de verdade sobre o "como" atual.*
