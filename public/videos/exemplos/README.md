# Vídeos de exemplo da home (carrossel "Exemplos em vídeo")

O componente `app/components/VideoExemplos.tsx` procura os arquivos aqui, por `slug`:

| Arquivo esperado         | Card / ocasião              |
|--------------------------|-----------------------------|
| `pamela.mp4`             | Pamela — Pedido de namoro   |
| `eduardo.mp4`            | Eduardo — Dia dos Pais      |
| `familia.mp4`            | Família — Chá revelação     |

Enquanto o arquivo não existir, o card mostra "🎬 vídeo em breve" (não quebra).

## Como exportar cada vídeo (otimizado pra banda baixa)

- Duração: até **40s**
- Vertical **9:16**, ~**720×1280**
- MP4 **H.264**, áudio AAC
- Alvo de peso: **3–4 MB** por vídeo

Exemplo de compressão com ffmpeg:

```
ffmpeg -i entrada.mov -vf "scale=720:-2" -c:v libx264 -crf 28 -preset veryslow \
  -movflags +faststart -c:a aac -b:a 96k -t 40 pamela.mp4
```

`-movflags +faststart` deixa o vídeo começar a tocar antes de baixar inteiro.

## Adicionar mais exemplos

Acrescente um item no array `EXEMPLOS` em `app/components/VideoExemplos.tsx`
(com `slug`, `nome`, `musica`, `ocasiao`, `duracao`, `grad`) e suba o `<slug>.mp4` aqui.
