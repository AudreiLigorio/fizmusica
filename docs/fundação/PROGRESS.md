# PROGRESS

## Status Geral

**Data do diagnóstico:** 2026-05-31

---

## FASE 0 — Arquitetura ✅

- Visão do produto definida
- Domínios definidos
- Roadmap definido
- Stack decidida
- Princípios arquiteturais congelados

---

## FASE 0.5 — Validação da Stack ✅ Concluída

- [x] GitHub: repositório ativo
- [x] Vercel: deploy funcionando
- [x] Next.js 16 + TypeScript + Tailwind 4 instalados
- [x] Prisma + PostgreSQL conectados
- [x] n8n: webhook fire-and-forget implementado em `orderService.ts`
- [x] Migrar banco para Supabase client (Prisma removido)
- [x] Instalar shadcn/ui + Radix UI
- [x] Instalar React Hook Form + Zod
- [x] Instalar @supabase/supabase-js
- [x] Criar página `/health`
- [x] Validar Mercado Pago (checkout sandbox funcionando)
- [x] Validar Storage (upload MP3 no bucket `songs` via service_role)
- [x] Validar QR Code (`qrcode.react` v4 funcionando em `/teste-qr`)

---

## FASE 1 — Estrutura Técnica ✅ Concluída

- [x] Migrar de Prisma/pg para Supabase client
- [x] Configurar RLS no Supabase (migration 003_rls.sql)
- [x] Configurar shadcn/ui como sistema de componentes
- [x] Estruturar pastas: `/components/ui`, `/lib/supabase`, `/lib/validators`
- [x] Configurar variáveis de ambiente para todas as integrações
- [x] Validators Zod em `/lib/validators/order.ts` e `/lib/validators/payment.ts`

---

## FASE 2 — Banco de Dados ✅ Concluída

- [x] 18/18 tabelas criadas no Supabase (migrations 001 + 002)
- [x] Seed completo aplicado (migration 004): 4 produtos + 5 ocasiões + 22 subcategorias + ~180 perguntas
- [x] API `/api/produtos` lendo do banco (sem fallback estático)
- [x] API `/api/wizard` retornando ocasiões, subcategorias e perguntas do banco
- [x] Wizard `/criar` desacoplado do `formStructure.ts` — 100% dinâmico via banco

---

## FASE 3 — Admin ⚠️ Parcial

- [x] Layout com sidebar (`/admin/layout.tsx`)
- [x] Dashboard — cards de métricas + pedidos recentes com dados reais
- [x] Pedidos — lista completa com status, pagamento, data + link para detalhe
- [x] Detalhe do pedido — cliente, preferências, respostas, pagamento + atualização de status
- [x] Produtos — listagem + edição inline (nome, preço, descrição, ativo, destaque)
- [x] APIs: `PATCH /api/orders/[id]/status` e `PATCH /api/admin/produtos/[id]`
- [x] **Login do admin** — middleware protege `/admin/*`, cookie HttpOnly assinado com HMAC, página `/admin/login`, logout na sidebar

---

## FASE 4 — Wizard Manager ✅ Concluída

- [x] `/admin/wizard` — lista de ocasiões com contagem de subcategorias, editar, excluir, criar
- [x] `/admin/wizard/[occasionId]` — subcategorias da ocasião, editar, excluir, criar
- [x] `/admin/wizard/[occasionId]/[subcategoryId]` — perguntas, editar, excluir, criar
- [x] APIs: CRUD completo para ocasiões, subcategorias e perguntas
- [x] Wizard do cliente (`/criar`) já consome do banco — mudanças no admin refletem imediatamente

---

## FASE 5 — Produtos ✅ Concluída

- [x] Listagem de produtos funcionando
- [x] Seleção de produto no fluxo
- [x] Urgência configurável — step 2 na `/produtos` com acréscimo de preço
- [x] Prazo configurável — Normal / Expresso / Urgente por produto
- [x] Entidade `product_delivery_options` — seed na migration 005, CRUD no admin
- [x] Admin `/admin/produtos` — gerenciar prazos inline por produto

---

## FASE 6 — Jornada do Cliente ✅ Concluída

- [x] Wizard visual (5 steps: ocasião, perguntas, estilo, dados, resumo)
- [x] Tela de produtos com step de prazo de entrega
- [x] Checkout Mercado Pago — preferenceId salvo, webhook corrigido (mpPaymentId, mpStatus), product_id + deliveryOptionId vinculados ao pedido
- [x] Página de sucesso real — busca status do banco, diferencia pago/pendente/recebido
- [x] Auth via Magic Link (Supabase) — `/entrar`, `/auth/callback`
- [x] Área do cliente autenticada — `/minha-musica` com histórico de pedidos
- [x] Homenageado — campo no wizard step 1, salvo em `honoreeName` no pedido
- [x] Migration 006 — `deliveryOptionId` + `honoreeName` na tabela orders

---

## FASE 7 — Produção ✅ Concluída

- [x] `/admin/producao` — fila de pedidos pagos com resumo (aguardando / em produção / entregues)
- [x] Briefing completo inline: ocasião, estilo, voz, emoção, homenageado
- [x] Upload de MP3 → Supabase Storage bucket `songs`
- [x] Salvar `generated_music` (título, letra, URL do MP3, nome do homenageado)
- [x] Status do pedido atualizado automaticamente para DELIVERED ao salvar MP3
- [x] "Produção" adicionado ao menu da sidebar do admin

---

## FASE 8 — Entrega ✅ Concluída

- [x] Página pública `/m/[slug]` — player de áudio, letra expansível, QR Code, botão WhatsApp
- [x] Slug único gerado automaticamente ao entregar
- [x] Migration 007 — coluna `slug` em `generated_music`
- [x] Botão "Entregar ao cliente" no admin — gera slug, envia e-mail + dispara n8n
- [x] E-mail de entrega (Resend) — HTML premium com link + botão play
- [x] Webhook n8n disparado com `event: music.delivered` + `publicUrl`
- [x] QR Code na página pública e no admin (pós-entrega)
- [x] Compartilhamento via WhatsApp direto da página pública

---

## FASE 9 — CRM ❌ Não iniciada

---

## FASE 10 — Automações ❌ Não iniciada

---

## Diagnóstico Técnico (2026-05-31)

### Alinhado ✅
- Stack base (Next.js 16, TypeScript, Tailwind 4)
- Conceito 1 música = 1 pedido refletido no schema
- Wizard multi-etapas funcional
- Estilo/voz/emoção capturados e salvos
- UI mobile-first, premium, identidade visual preservada
- n8n webhook integrado

### Ajustes necessários ⚠️
- Wizard hardcoded → precisa vir do banco
- Cliente embutido em `Order` → precisa ser entidade `customers` separada
- IDs CUID → UUID
- Sem soft delete → adicionar `deleted_at`
- shadcn/ui e Radix UI ausentes → instalação em andamento
- React Hook Form + Zod ausentes → instalados
- Supabase ausente → @supabase/supabase-js instalado

### Gaps críticos ❌
- 13 entidades do schema não existem
- Nenhuma autenticação
- Nenhum admin
- Wizard não é parametrizável
- Homenageado não existe como entidade
- Sem pagamento real (MercadoPago não integrado)
- Sem fila/fluxo de produção
- Sem página pública da música
- Sem QR Code
- Sem entrega automatizada
