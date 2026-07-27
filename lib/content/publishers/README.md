# Publicadores de conteúdo nas redes

Publicação automática dos rascunhos aprovados em `/admin/conteudo`.

## ⏳ Validade das credenciais — ATUALIZE AO RENOVAR

Tabela lida por uma rotina agendada mensal (nuvem), que avisa quando falta
pouco. **Ao renovar/reconectar, edite a data aqui e faça commit** — a rotina
não tem como descobrir isso sozinha (não acessa `.env.local`, Vercel nem o
banco).

| Credencial | Última renovação | Validade | Como renovar |
|---|---|---|---|
| `IG_LONG_LIVED_TOKEN` (Instagram) | 2026-07-24 | 60 dias | `bash scripts/ig-token-check.sh`, depois atualizar no `.env.local` **e** na Vercel |
| TikTok `refresh_token` (`tiktok_auth`) | (ainda não conectado) | ~365 dias | Reconectar em `/admin/conteudo` → "Conectar TikTok" |

O `access_token` do TikTok (24h) se renova sozinho pelo `refresh_token` — não
precisa de lembrete. O que expira de vez é o **refresh**: se ficar ~365 dias
sem uso/renovação, a conta precisa ser reconectada na mão.

## Instagram — ATIVO ✅

Fluxo "Instagram API with Instagram Login" (endpoint `graph.instagram.com`,
sem depender de página do Facebook). Código: `instagram.ts` (chamadas à API) +
`../publish.ts` (orquestra storage + publicação + registro no banco).

**Como funciona:** o admin aprova um rascunho e clica "📤 Publicar no
Instagram". A API faz o fluxo de 2 passos da Meta (cria container → publica).
Imagem é convertida PNG→JPEG (exigência do IG) via `sharp`; vídeo é publicado
como Reels (com polling do processamento).

### Variável de ambiente

- `IG_LONG_LIVED_TOKEN` — token de acesso de **longa duração (60 dias)** da
  conta `@fiz_musica`. Já está no `.env.local` (local). **Falta adicionar na
  Vercel** (Project → Settings → Environment Variables) pra publicar em
  produção.

O id da conta é resolvido automaticamente via `/me` (o token é a fonte de
verdade), então não precisa de env var separada pro user id.

### ⚠️ O token EXPIRA em 60 dias — precisa renovar

O token de longa duração vale ~60 dias. Renovar é simples e **cada renovação
estende por mais 60 dias** a partir da data da renovação:

```bash
bash scripts/ig-token-check.sh
```

Copie o token atual do painel da Meta quando pedir (ou o próprio valor que está
no `.env.local`). O script chama o endpoint de *refresh* e imprime o token novo
já pronto pra colar. Depois:
1. Substitua `IG_LONG_LIVED_TOKEN` no `.env.local`.
2. Atualize a mesma variável na Vercel.

> Dica: renove por volta do 50º dia pra ter folga. Um lembrete no calendário
> resolve — não há renovação automática (fora de escopo).

## TikTok — PENDENTE

Depende de aprovação do TikTok for Developers (Content Posting API, revisão de
1-2 semanas + vídeo de demonstração + flag `is_ai_generated`). Ainda não
registrado. A UI já mostra "publicação não disponível" pra rascunhos de TikTok.

## YouTube — PENDENTE

Depende do YouTube Data API v3 (Google Cloud Console → OAuth consent screen →
credenciais). Ainda não configurado. A UI já mostra "publicação não disponível"
pra rascunhos de YouTube.
