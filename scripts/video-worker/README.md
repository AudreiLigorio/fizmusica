# Worker de vídeo (roda na sua máquina)

Monta o vídeo multi-cena (Ken Burns + crossfade + texto por cena + clímax da
música sincronizado) a partir dos ingredientes que o admin gera pelo painel
(`/admin/conteudo` → "🎬 Criar vídeo"). **Não roda no Vercel** — ffmpeg não
funciona lá. Por isso esse worker roda localmente, fazendo *polling* na tabela
`video_jobs`.

## Por que sua máquina, e não a nuvem

Decisão consciente: mais simples e sem custo de infraestrutura nova, mas com
uma limitação real — **o vídeo só é produzido enquanto o worker está rodando**.
Se você fechar o terminal ou desligar o computador, os jobs ficam esperando em
`pronto_pra_renderizar` até você rodar de novo. Não é bug, é o trade-off da
escolha.

## Dependências (uma vez só, nesta máquina)

- **ffmpeg** com suporte a `ebur128` (já vem no build padrão do Homebrew —
  confirmado nesta máquina).
- **Python 3 + Pillow** (`pip3 install pillow`, se ainda não tiver — já
  confirmado disponível aqui).
- **Node 22+** (já é o que roda o resto do projeto).

## Como rodar

```bash
npm run worker:video
```

Fica rodando (`Ctrl+C` pra parar), verificando a cada 15s se tem vídeo pra
renderizar. Só precisa de `SUPABASE_SERVICE_ROLE_KEY` e
`NEXT_PUBLIC_SUPABASE_URL` no `.env.local` (já configurados) — **não precisa**
de `KIE_API_KEY` nem `GEMINI_API_KEY`: quem gera imagem/música é o Next.js na
Vercel; o worker só baixa o resultado e monta.

## O que ele faz, por dentro

1. Baixa as N imagens de cena + a música (já geradas pelo Next.js).
2. Zoom lento (Ken Burns) em cada cena, `ffmpeg.ts:renderSceneClip`.
3. Encadeia as cenas com crossfade, `ffmpeg.ts:concatWithCrossfade`.
4. Gera as legendas + barra de marca como PNG (`overlays.py` — Python/Pillow,
   porque o ffmpeg local não tem `drawtext`/freetype) e sobrepõe,
   `ffmpeg.ts:overlayPngs`.
5. **Acha sozinho o ponto mais forte da música** (`ffmpeg.ts:detectClimaxStart`
   — analisa o volume segundo a segundo via `ebur128` e escolhe a janela de
   maior volume médio do tamanho do vídeo) e corta esse trecho pra sincronizar
   com a cena final.
6. Sobe o MP4 final pro bucket `content-media` e atualiza `video_jobs` +
   `content_drafts.video_url` (aparece na tela de qualificação).

## Se der erro

O job fica com `status = 'falhou'` e o campo `error` preenchido — visível no
painel. Rodar de novo é criar um novo vídeo pelo formulário (não há retry
automático nesta versão).
