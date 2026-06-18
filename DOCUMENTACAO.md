# FizMusica — Documentação do Projeto

> Plataforma de **músicas personalizadas**: o cliente conta sua história num wizard, paga, e recebe uma música feita sob medida — com player próprio, fotos e QR Code. Inclui painel administrativo completo e área do cliente.

Domínio: **https://fizmusica.com.br**

---

## 1. Visão geral / contexto

FizMusica transforma uma história pessoal em uma música personalizada. O fluxo central:

1. O cliente preenche um **wizard** (ocasião → subcategoria → perguntas abertas → estilo/voz/emoção → dados de contato).
2. Escolhe um **produto** (Música Digital, Box Premium etc.) e **paga** (Mercado Pago: cartão, PIX, boleto).
3. Acessa uma **área pessoal** (login sem senha) para acompanhar o status e **cadastrar fotos** que aparecem no player.
4. A equipe **produz** a música no admin (letra, LRC sincronizado, MP3, efeito das fotos) e **entrega**.
5. O cliente recebe a música num **player público** (`/m/[slug]`) com QR Code, e é convidado a **avaliar**.

Objetivo de produto: evoluir de venda avulsa para **relacionamento/recorrência** (área do cliente, novas músicas, futuras assinaturas).

---

## 2. Tecnologias (stack)

| Camada | Tecnologia |
|---|---|
| Framework | **Next.js 16** (App Router, Server/Client Components, Route Handlers) |
| Linguagem | TypeScript, React 19 |
| Estilo | Tailwind CSS |
| Banco de dados | **PostgreSQL** (via **Supabase**) |
| Acesso a dados | `@supabase/supabase-js` (queries) + `pg`/Prisma adapter (migrações SQL) |
| Autenticação cliente | **Supabase Auth** (passwordless: magic link + Google OAuth) |
| Autenticação admin | Cookie HMAC próprio (`lib/admin-auth`) |
| Pagamentos | **Mercado Pago** (Checkout Bricks + API de pagamentos) |
| E-mails | **Resend** (domínio verificado, DKIM/SPF) |
| Armazenamento de arquivos | **Supabase Storage** (buckets) |
| Carrossel/player | **Swiper.js 12** |
| QR Code | `qrcode` / `qrcode.react` |
| Validação | `zod` |
| Automação | **n8n Cloud** (webhooks de eventos → WhatsApp, futuro) |

---

## 3. Hospedagem, região e infraestrutura

- **Aplicação (frontend + APIs):** **Vercel** (projeto `fizmusica`). As funções serverless rodam na **região padrão do projeto na Vercel** (configurável; hoje sem override em `vercel.json`).
- **Banco de dados + Auth + Storage:** **Supabase** (projeto `esjjcqwxcflppyqrixqt`), hospedado em **AWS us-west-1 (Oregon, EUA)**.
- **E-mail:** Resend (envio pelo domínio `fizmusica.com.br`).
- **Deploy:** manual via `npx vercel --prod` (auto-deploy GitHub↔Vercel pendente de reconexão — ver Backlog).
- **Cron:** `vercel.json` agenda `/api/cron/recovery` **1x/dia** (10:00 UTC) — limite do plano Hobby.

> **Observação de residência de dados:** banco, contas e arquivos (incl. fotos de clientes) ficam em servidores nos **EUA** (Supabase/AWS us-west-1). Relevante para a política de privacidade/LGPD (transferência internacional de dados).

---

## 4. Arquitetura

- **App Router do Next.js**: páginas (`page.tsx`) e APIs (`route.ts`) no diretório `app/`.
- **Dois clients Supabase** (`lib/supabase.ts`):
  - `supabase` (anon key) → usado no **navegador** (sessão do cliente em localStorage).
  - `createServerClient()` (service_role key) → usado em **APIs/Server Components** (ignora RLS).
- **Proxy/Middleware** (`proxy.ts`): protege todas as rotas `/admin/*` exigindo cookie admin válido.
- **Serviços** (`app/services/`): `emailService` (Resend), `orderService` (criação de pedido, n8n).
- **Libs** (`lib/`): `admin-auth` (cookie HMAC), `imageValidation` (segurança de upload), `paymentAlerts` (duplicidade).

---

## 5. Banco de dados — tabelas e dados do cliente

Tabelas principais (PostgreSQL/Supabase). **Dados pessoais marcados** para fins de privacidade.

### `orders` (pedido)
Contato e preferências do cliente:
- **nome, email, whatsapp** (PII)
- context, subcategory, musicalStyle, voiceType, emotion
- **honoreeName** (nome do homenageado — PII de terceiro)
- **Envio físico (quando aplicável):** shipping_name, shipping_cep, shipping_address, shipping_number, shipping_complement, shipping_neighborhood, shipping_city, shipping_state, shipping_phone (PII — endereço)
- productId, deliveryOptionId, status, paymentStatus, photo_effect
- **photo_token** (uuid, acesso sem login às fotos), **userId** (conta vinculada)
- createdAt, updatedAt

### `order_answers` (respostas do wizard)
- question, **answer** (texto livre da história do cliente — pode conter dados sensíveis), position

### `payments`
- amount, status, **mpPaymentId**, mpPreferenceId, mpStatus, paidAt (identificadores da transação no Mercado Pago)

### `generated_music`
- musicName, **personName**, lyrics, lyricsLrc, mp3Url, imageUrl, slug (música entregue)

### `order_photos`
- **url, storage_path** → **fotos enviadas pelo cliente** (imagens de pessoas — dado pessoal/sensível), is_cover, sort_order

### `order_claims`
- **email**, userId, token (vínculo de pedido a conta por e-mail divergente)

### `wizard_sessions`
- **data (JSON com nome/email/whatsapp/respostas)**, step — sessão anônima do wizard (recuperação de abandono)

### `feedbacks`
- rating, highlight, improvement, token (avaliação pós-entrega)

### `payment_alerts`
- orderId, mpPaymentId, previousMpPaymentId, amount (alerta de possível duplicidade)

### Wizard configurável (admin)
- `wizard_occasions`, `wizard_subcategories`, `wizard_questions`, `wizard_question_options`
- `products`, `product_delivery_options`

### Supabase Auth (`auth.users`)
- **e-mail** de login; via Google: **nome e foto de perfil** (user_metadata), provedor.

### Supabase Storage (buckets)
- `order-photos` — **fotos dos clientes** (público para o player)
- `product-images` — imagens dos produtos (admin)
- `songs` — MP3 das músicas

---

## 6. Jornadas

### 6.1 Jornada do cliente
1. **Home** (`/`) → **Criar** (`/criar`): wizard (ocasião → subcategoria → perguntas → estilo/voz/emoção → captura de lead: nome/e-mail/WhatsApp).
2. **Produtos** (`/produtos`): escolhe o produto e o prazo (ou dados de envio se físico).
3. **Checkout** (`/checkout`): paga via Mercado Pago. **PIX mostra o QR na tela** e confirma sozinho.
4. **Sucesso** (`/sucesso`): CTA único "Entrar na minha área".
5. **Área do cliente** (`/minha-musica`): login sem senha (Google/e-mail) → status (linha do tempo), **cadastrar fotos**, ouvir a música quando pronta, criar nova música.
6. **Player público** (`/m/[slug]`): ouve a música com letra sincronizada, fotos no fundo, QR para compartilhar.
7. **Avaliação** (`/feedback/[token]`): nota + comentários.

### 6.2 Jornada do admin
- **Dashboard** (`/admin`), **Pedidos** (`/admin/pedidos`) com busca/filtros, **Produção** (`/admin/producao`) — fila, fotos do cliente, efeito, produção da música (letra/LRC/MP3) e **entrega**.
- **Produtos** (`/admin/produtos`), **Wizard** (`/admin/wizard`) configurável, **CRM** (`/admin/crm`), **Logs/Alertas** (`/admin/logs`).
- Prévia "👁 Simular player" antes de entregar (`/admin/producao/preview/[orderId]`).

---

## 7. Rotas

### 7.1 Páginas públicas
| Rota | Função |
|---|---|
| `/` | Home / landing |
| `/criar` | Wizard de criação (com recuperação de sessão) |
| `/produtos` | Escolha de produto + prazo/envio |
| `/checkout` | Pagamento (Mercado Pago Bricks; PIX com QR na tela) |
| `/sucesso` | Confirmação pós-pagamento |
| `/entrar` | Login do cliente (magic link + Google) |
| `/auth/callback` | Retorno do login (grava sessão no navegador) |
| `/minha-musica` | Área do cliente (status, fotos, ouvir, vincular pedido) |
| `/pedido/[token]/fotos` | Upload de fotos por token (sem login) |
| `/m/[slug]` | Player público da música |
| `/feedback/[token]` | Avaliação pós-entrega |
| `/health` | Diagnóstico |

### 7.2 Páginas admin (protegidas por `proxy.ts`)
`/admin`, `/admin/login`, `/admin/pedidos`, `/admin/pedidos/[id]`, `/admin/producao`, `/admin/producao/preview/[orderId]`, `/admin/produtos`, `/admin/wizard` (+ ocasiões/subcategorias), `/admin/crm`, `/admin/logs`.

### 7.3 APIs principais
**Pedidos/jornada:** `POST/GET /api/orders`, `GET/PATCH /api/orders/[id]`, `GET/PUT /api/wizard-session`, `GET /api/wizard`, `GET /api/produtos`.

**Pagamentos:** `POST /api/payments/create`, `POST /api/payments/confirm`, `POST /api/payments/webhook`, `GET /api/payments/status`.

**Conta/vínculo:** `POST /api/conta/claim`, `GET /api/conta/claim/confirm`, `GET/POST /api/conta/link-order`.

**Fotos:** `/api/pedido/[token]/fotos` (cliente, por token), `/api/admin/pedidos/[id]/fotos` (admin).

**Feedback:** `GET/POST /api/feedback/[token]`.

**Admin:** `/api/admin/auth`, `/api/admin/produtos/*`, `/api/admin/wizard/*`, `/api/admin/producao/[id]` (+ `/entregar`, `/upload-url`), `/api/admin/pedidos/[id]`, `/api/admin/payments/sync`, `/api/admin/payment-alerts/[id]`, `/api/admin/crm/*`.

**Automação:** `GET /api/cron/recovery` (cron diário de recuperação de abandono).

---

## 8. Pagamentos (Mercado Pago)

- **Checkout Bricks** no `/checkout` (cartão crédito/débito, PIX, boleto, saldo MP), parcelamento até 12x.
- **PIX na tela:** o QR (`qr_code_base64`) e o copia-e-cola vêm na resposta do pagamento; a tela mostra e faz **polling** (`/api/payments/status`, consulta banco **e** Mercado Pago) até confirmar, sem o cliente sair.
- **Vínculo pagamento↔pedido:** `external_reference = orderId`. O webhook recebe o id do pagamento, lê o `external_reference` e atualiza o pedido.
- **Confirmação:** webhook do MP (`/api/payments/webhook`) + confirmação na tela de sucesso (`/api/payments/confirm`).
- **Anti-duplo-pagamento:** o `create` recusa se o pedido já está pago; o checkout redireciona ao sucesso; e há **alerta de duplicidade** (e-mail + tela `/admin/logs`) se um segundo pagamento aprovado chegar.

---

## 9. E-mails (Resend, layout único da marca)

**Cliente:** abandono do wizard, pedido recebido, recuperação de não-pago, **pagamento confirmado** (→ área), reivindicar pedido, **entrega da música** (QR + MP3 anexo), avaliação. Login (link mágico) via Supabase.

**Admin (assunto com `[Admin]`):** novo pedido, pedido pago, alerta de pagamento duplicado.

Todos usam um template-base (`emailShell`) com header gradiente (+ cor sólida de reserva para o Gmail) e botões "à prova de e-mail" (tabela + `bgcolor`).

---

## 10. Autenticação

### Cliente — passwordless (Supabase Auth)
- **Link mágico** por e-mail (`signInWithOtp`) e **Google** (`signInWithOAuth`).
- `/auth/callback` é página client → grava a sessão no navegador; `AuthHashHandler` (layout raiz) captura o token mesmo se cair na home.
- Sessão no navegador (localStorage); APIs sensíveis validam o **JWT** via `getUser(token)`.

### Admin — cookie HMAC próprio
- Senha (`ADMIN_PASSWORD`) → token assinado HMAC-SHA256 (`lib/admin-auth`), cookie httpOnly por 7 dias.
- `proxy.ts` protege `/admin/*`. APIs `/api/admin/*` sensíveis revalidam o cookie (`verifyAdminToken`).

---

## 11. Segurança

- **Upload de fotos defensivo** (`lib/imageValidation`): validação por **magic bytes** (assinatura do arquivo), só JPEG/PNG/WebP (**sem SVG**, evita XSS), **≤ 8 MB**, **máx. 5 por pedido**, **nome aleatório** gerado no servidor (sem path traversal). Não confia em extensão nem Content-Type.
- **RLS (Row Level Security)** habilitado nas tabelas; escrita/leitura sensível só via `service_role` no servidor; leitura pública só onde necessário (player, wizard).
- **Pagamentos:** confirmação **server-side via webhook** (a tela nunca decide se pagou); anti-duplo-pagamento + alerta de duplicidade.
- **Vínculo de pedidos com verificação:** reivindicação confirmada **no e-mail da compra**; vínculo automático só para pedido recente (<24h) da própria jornada.
- **Acesso por token:** páginas de fotos e feedback usam **UUID aleatório** (capability URL); a área do cliente exige **login** (não é capability URL).
- **APIs admin** revalidam o cookie de admin (mesmo o `proxy` cobrindo só as páginas).
- **HTTPS** em todo o domínio; segredos em variáveis de ambiente.

### Pontos de atenção / backlog de segurança
- **CSP (Content-Security-Policy)** ainda não configurado (cuidado com o Brick do MP) — no backlog.
- Endpoints de leitura por e-mail/token seguem modelo de confiança pragmático; o `/api/orders` já evoluiu para validar JWT.

---

## 12. Variáveis de ambiente / integrações

- **Supabase:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`/`DIRECT_URL`.
- **Mercado Pago:** `MP_ACCESS_TOKEN`, `NEXT_PUBLIC_MP_PUBLIC_KEY`.
- **Resend:** `RESEND_API_KEY`; remetente `contato@fizmusica.com.br`; `ADMIN_NOTIFY_EMAIL`.
- **Admin:** `ADMIN_PASSWORD`, `ADMIN_SECRET` (assinatura do cookie).
- **App:** `NEXT_PUBLIC_BASE_URL` (= `https://fizmusica.com.br`).
- **n8n:** `N8N_WEBHOOK_URL` (eventos: order.created, payment.confirmed, music.delivered, feedback.request).
- **Cron:** `CRON_SECRET` (injetado pela Vercel).

---

## 13. Operação

- **Migrações:** arquivos SQL em `prisma/migrations/` aplicados no Postgres (via pooler do Supabase).
- **Deploy:** `npx vercel --prod` (manual). Hard reload no navegador após deploy (cache).
- **Recuperação de abandono:** cron diário marca pedidos UNPAID antigos e dispara e-mail.
- **Monitoramento de pagamento:** botão "Sincronizar" no admin + alertas em `/admin/logs`.

---

## 14. Pendências (backlog)

Branding do login Google / custom domain de auth · CSP · contador de expiração do QR PIX · reconectar auto-deploy GitHub↔Vercel · WhatsApp Business (Meta) + n8n · Fase 3 (recorrência: datas especiais, desconto recorrente, assinatura/playlist).

---

*Documento gerado a partir do código-fonte. Para detalhes de implementação, consulte os arquivos citados (`app/`, `lib/`, `prisma/migrations/`).*
