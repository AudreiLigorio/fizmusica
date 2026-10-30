# Tutoriais em vídeo

Gravação automática de tutoriais: o Playwright navega pelo sistema de verdade
com vídeo contínuo, e a narração é sintetizada pelo Gemini (mesma chave que já
move a letra — sem serviço novo).

## Rodar

```bash
set -a && . ./.env.local && set +a
npx tsx scripts/tutoriais/area-do-cliente.ts
```

Sai em `scripts/tutoriais/saida/`.

Só roda local: precisa de ffmpeg e de um navegador de verdade, e nenhum dos
dois existe no Vercel.

## Como funciona

A **narração é gerada antes** de o navegador abrir, e é ela que dita o ritmo:
cada cena dura exatamente o tempo da sua frase. Sem isso sobraria o problema
clássico de narrar vídeo pronto — ou a voz atropela a tela, ou a tela fica
parada esperando a voz.

O Playwright não desenha cursor no vídeo que grava, então `gravar.ts` injeta um
ponteiro próprio que segue o mouse e dá um "pulso" a cada clique. Sem ele o
tutorial vira "coisas acontecendo sozinhas".

## Escrever um tutorial novo

Copie `area-do-cliente.ts`. Um roteiro é uma lista de cenas:

```ts
{
  narracao: "o que a voz diz",   // define quanto a cena dura
  acao: async (p) => { ... },    // o que acontece na tela enquanto isso
}
```

Cena que falha não derruba a gravação — o log diz qual revisar.

## Cuidados

- **Nada que altere estado.** A gravação roda contra a produção; um clique em
  "Tirar da Rede", "Excluir" ou "Salvar" mexeria numa conta real.
- **Admin não pode ser gravado assim.** As telas de operação mostram nome,
  e-mail, WhatsApp e história de clientes reais. Para tutorial de admin é
  preciso base de demonstração com dados falsos, ou borrão nos campos.
- A conta de demonstração é `fizmusicaoficial@gmail.com`. O login usa link por
  e-mail emitido pelo admin — nenhuma senha passa por aqui.
