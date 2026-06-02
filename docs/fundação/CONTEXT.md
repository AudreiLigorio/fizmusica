# CONTEXT

## Projeto

Fiz Música — plataforma de músicas personalizadas como experiências emocionais.

## Missão

Transformar histórias em músicas inesquecíveis.

## Estado atual (2026-05-31)

O projeto possui uma casca funcional construída antes da Fase 1 do roadmap oficial.
O diagnóstico completo está em `PROGRESS.md`.

## Próximo passo imediato

Concluir Fase 0.5 (Validação da Stack):
1. Instalar shadcn/ui ← em execução
2. Migrar para Supabase
3. Criar página `/health`

## Stack

- Next.js 16 + TypeScript + Tailwind 4 + shadcn/ui + Radix UI
- Banco: PostgreSQL via Supabase (RLS obrigatório)
- Auth: Supabase Auth (Google, Magic Link, e-mail)
- Storage: Supabase Storage (MP3, imagens)
- Pagamentos: Mercado Pago
- E-mail: Resend
- Automações: n8n
- Hospedagem: Vercel + Cloudflare
- Forms: React Hook Form + Zod

## Arquivos principais

| Arquivo | Função |
|---|---|
| `app/criar/page.tsx` | Wizard do cliente (5 steps) |
| `app/produtos/page.tsx` | Seleção de produto |
| `app/sucesso/page.tsx` | Confirmação (simulada, sem pagamento real) |
| `app/api/orders/route.ts` | POST criar pedido |
| `app/api/produtos/route.ts` | GET listar produtos |
| `app/services/orderService.ts` | Lógica de pedidos + webhook n8n |
| `app/data/formStructure.ts` | Wizard hardcoded (migrar para banco na Fase 4) |
| `prisma/schema.prisma` | Schema atual (migrar para Supabase na Fase 1) |
| `lib/prisma.ts` | Cliente Prisma (substituir por Supabase client na Fase 1) |

## Decisões congeladas

Ver `MASTER_CONTEXT.md` e `MASTER_CONTEXT_FULL.md`.
