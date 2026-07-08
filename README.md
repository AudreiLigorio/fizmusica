# Fiz Música

Next.js 16 (App Router) + React 19 + Supabase + Mercado Pago + KIE.ai (Suno) + Gemini. Deploy automático na Vercel a partir de `main` (push = deploy).

## Setup em uma máquina nova

Não há dependências nativas nem serviços locais (Postgres, Redis, etc.) — tudo roda contra serviços remotos (Supabase, Mercado Pago, KIE.ai, Gemini, Resend, Cloudflare, Sentry). Não precisa de Docker.

1. **Node 22** (versão fixada em `.nvmrc`, mesma do CI):
   ```bash
   nvm install
   nvm use
   ```
2. **Clonar e instalar:**
   ```bash
   git clone https://github.com/AudreiLigorio/fizmusica.git
   cd fizmusica
   npm install
   ```
3. **Variáveis de ambiente** — `.env.local` nunca é commitado (está no `.gitignore`). Pegue a cópia segura (gerenciador de senhas) com as chaves de: Supabase (URL, anon key, service role), Mercado Pago, Resend, GCP/Gemini, KIE.ai, Cloudflare, admin. Sem elas o app não sobe.
4. **Rodar:**
   ```bash
   npm run dev
   ```
   Abre em [http://localhost:3000](http://localhost:3000).

## Banco de dados

`prisma/schema.prisma` e `prisma/migrations/*.sql` são só referência/histórico — não há Prisma Client nem `pg` rodando em runtime. Migrações novas são aplicadas manualmente no **SQL Editor do Supabase** (a conexão direta ao banco não é alcançável daqui nem da Vercel — host IPv6-only).

## Deploy

Push em `main` → deploy automático na Vercel. Não usar `vercel --prod` como padrão (só em emergência).
