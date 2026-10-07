# App Android — plano

> Estado (2026-10-07): **app gerado (Bubblewrap) e criado no Play Console; enviando a primeira versão para o teste interno.** Resumo em `DOCUMENTACAO.md`, seção 22. Ver "Onde paramos" no fim.

## Objetivo

**Tudo acontece dentro do app**, inclusive a compra. Web no computador e web no celular continuam funcionando como hoje. É **um código só**: o site detecta quando está rodando dentro do app e só nesse caso muda o que precisa mudar (hoje, só a tela de pagamento).

## Decisão: TWA agora, Flutter depois de validar

| Opção | O que é | Papel no plano |
|---|---|---|
| **TWA** (Trusted Web Activity, via Bubblewrap/PWABuilder) | o app da Play Store abre o site em tela cheia, usando o Chrome | **agora** |
| **Flutter** | app nativo reescrito em Dart, consumindo as mesmas `/api` | **depois**, se os números validarem |
| Capacitor | site dentro de uma WebView com plugins nativos | meio-termo, só se o iPhone virar meta antes da hora |
| Híbrido Flutter + WebView (migrar tela a tela) | — | **não fazer**: perde as vantagens do Chrome e o login Google é bloqueado em WebView |

**Por que começar pelo TWA:** o produto muda rápido e o projeto já sofre com bugs de "dois caminhos" (entrega em dois pontos, 6 pontos de pagamento, visitante vendo mais que o logado). Duas bases de código multiplicariam isso. Com o TWA, cada deploy na Vercel atualiza web e app juntos, sem revisão da loja.

### Comparação na visão do cliente

| Momento | TWA | Capacitor | Flutter |
|---|---|---|---|
| Baixar | ✅ ~1 MB | ~5–10 MB | ~15–25 MB |
| Abrir | depende da internet | parecido com o TWA | ✅ instantâneo, até offline |
| Sensação | "site bem feito" | "site bem feito" | ✅ app de verdade |
| Login | ✅ já chega logado se entrou pelo site no Chrome | loga de novo | loga de novo (Google em 1 toque) |
| Pagar | ✅ igual ao site, cartão salvo do Chrome | tela embutida, sem autofill | ✅ Google Play nativo |
| Continuar pedido do site | ✅ automático | por link/conta | por link/conta |
| Ouvir com a tela bloqueada | funciona, mas o Android pode cortar | melhor | ✅ controles na tela de bloqueio |
| Ouvir offline | ❌ | possível | ✅ |
| Compartilhar | menu do sistema | ✅ nativo | ✅ direto nos Stories |
| Notificações | ✅ simples | ✅ ricas | ✅ ricas |
| Atualização | ✅ nunca precisa, correção na hora | pela loja* | pela loja, correção leva dias |
| Site e app iguais | ✅ | ✅ quase | ❌ duas experiências |
| iPhone | ❌ a Apple recusa site embrulhado | ✅ | ✅ |

\* A menos que carregue o site ao vivo; aí se comporta como o TWA.

**O ponto que decide:** quem **compra** vem de anúncio, presenteia uma vez e quase nunca instala app; para ele o que importa é a web. Quem **instala** é quem volta (ouvir, Rede, Carreira, datas especiais), e é justamente aí que o Flutter mais ganha. Por isso o Flutter fica como segunda etapa, decidida com dados.

## Pagamento

### As regras do Google Play (pesquisa de 2026-09-26)

- Conteúdo **digital** comprado dentro do app tem que passar pelo **Google Play Billing**. A música personalizada entra aqui.
- Isentos: bens e serviços **físicos**. A parte física de um plano escapa.
- Venda no **site** não tem nada a ver com o Google: taxa zero.
- O Brasil está no **User Choice Billing**: o cliente pode escolher Google Play ou outro meio (Mercado Pago) dentro do app, mas o Google cobra mesmo assim, com 4 pontos a menos (~11% no programa de pequenas empresas), e cada venda precisa ser reportada ao Google em até 24h.
- **Links externos** ("pague no site"), pelas regras novas, chegam ao Brasil em **30/09/2027**; as taxas para Brasil/América Latina ainda não foram divulgadas. Até lá, é proibido, dentro do app, mandar o cliente pagar no site.
- É permitido cobrar **preço diferente** no app e no site.
- Os números exatos para o Brasil aparecem no Play Console na hora da inscrição. Conferir lá antes de fechar preço.

### Decisão (2026-09-26)

**No app, só Google Play Billing.** Taxa de 15% no programa de pequenas empresas (até US$ 1 milhão/ano). Sem User Choice Billing, então sem tela de escolha e sem reportar venda ao Google. Web segue só com Mercado Pago.

Quando os links externos chegarem ao Brasil, reavaliar ativar "pagar no site" dentro do app. Há uma tarefa agendada mensal (dia 1º, 9h) no app Claude, `monitor-google-play-links-externos-brasil`, que checa mudança de data, taxas, CADE/lei e User Choice Billing.

### Armadilhas do Play Billing

- **Preço fixo por produto** cadastrado no Play Console. Cupom, desconto da Carreira e upsell não encaixam direto: ou ficam só no site, ou viram faixas de preço pré-cadastradas / ofertas e códigos promocionais da Play (mais limitados).
- A validação da compra no servidor (Play Developer API + notificações em tempo real) vira o **7º ponto de pagamento**. Toda automação de "pago" (e-mails, discos da Carreira, cupom, vínculo à conta) tem que rodar nele também. Usar o mesmo helper idempotente dos outros pontos.
- **Reembolso** pelo Google chega por notificação e precisa refletir no pedido.

## Plano agora — TWA, em fases

1. **Base do app**
   - `app/manifest.ts`: nome, cores, ícones 192/512 + maskable, `start_url` apontando para a área do cliente.
   - Service worker + página offline (requisito de instalação).
   - `/.well-known/assetlinks.json`: prova que app e domínio são do mesmo dono (sem isso aparece a barra do Chrome).
   - **App Links**: o magic link do e-mail precisa abrir **dentro do app**. Sem isso o cliente loga no Chrome e o app fica deslogado.
   - Botão voltar do Android não pode tirar o cliente do app no meio do wizard.
   - Marcar o tráfego que vem do app em `lib/track.ts` (sem isso não dá para validar nada).
2. **Exclusão de conta** — a Play exige dentro do app **e** por link na web. Não existe hoje. MP3 e letra ficam (direito da Licença, cláusulas 6+9); o resto segue a lógica do expurgo LGPD.
3. **Pagamento no app** — Play Billing via Digital Goods API + Payment Request API do Chrome, produtos no Play Console, validação e reembolso no servidor.
4. **Loja** — formulário de segurança dos dados (fotos, e-mail, microfone, Sentry), classificação indicativa, ícone 512, banner 1024×500, prints, política de privacidade (item de revisão legal sobre o app). Conta pessoal nova exige **teste fechado com 12 testadores por 14 dias**; conta de empresa (CNPJ + D-U-N-S) pula isso. Taxa única de US$ 25.
5. **Push** (opcional): música pronta, datas especiais, palmas da Rede.

Ordem: **fases 1 e 2 primeiro** (deixam o app aprovável e não mexem na web); fase 3 depois de fechar preço e descontos.

Estimativa: fase 1 em 1–2 dias; fase 2 em 1–2 dias; push em 2–3 dias. O que mais pesa no calendário é a loja (até 2–3 semanas por causa do teste fechado).

## Longo prazo — migração para Flutter

- Vira **atualização** do mesmo app, não app novo, se forem iguais desde o primeiro dia:
  1. o **identificador do pacote** (ex.: `br.com.fizmusica.app`) — definitivo, escolher bem;
  2. a **chave de assinatura** (usar Play App Signing e guardar a chave de envio).
- Herda: downloads, avaliações e nota, página da loja, compras do Google Play, `assetlinks.json`.
- O cliente perde uma vez só: a sessão (loga de novo) e a permissão de notificação (push web não vira push nativo). Dados do navegador são quase nada (sessão do wizard, recuperável pelo `orderId`, e origem de rastreamento).
- O projeto já está pronto para isso: **zero server actions**, toda a lógica em `/api` (26 grupos), Supabase tem SDK Flutter. Servidor, banco, Suno/KIE, Gemini e e-mails são aproveitados; só as telas se refazem.
- Regra para manter até lá: **toda lógica de negócio passa por `/api`**, nada escondido em telas.

### Como saber que validou

Combinar antes de lançar:

- retenção D7 e D30 de quem instalou;
- reproduções e palmas pelo app × web;
- compras (primeira e recompra) pelo app;
- aceite de notificação;
- reclamações que só o nativo resolve (ouvir offline, tela bloqueada, Stories).

## Decisões em aberto

1. Conta de desenvolvedor pessoal ou de empresa?
2. Preço no app igual ao do site (absorve os 15%) ou maior?
3. Cupom e desconto da Carreira no app: só no site, ou faixas/ofertas da Play?
4. iPhone entra no plano? Se sim, reavaliar Flutter/Capacitor antes do previsto.

## Fontes

- [Política de pagamentos do Google Play](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en)
- [User Choice Billing — países e taxa](https://support.google.com/googleplay/android-developer/answer/13821247?hl=en)
- [Taxas de serviço — Play Console](https://support.google.com/googleplay/android-developer/answer/112622?hl=pt-BR)
- [Mobile Time — novo modelo de cobrança (março/2026)](https://www.mobiletime.com.br/noticias/04/03/2026/google-play-fim-monopoli/)
- [LeiaJá — Play Store amplia pagamentos alternativos (junho/2026)](https://www.leiaja.com/tecnologia/2026/06/25/google-play-store-amplia-formas-alternativas-de-pagamento-e-unifica-as-comissoes/)

## Onde paramos (2026-09-29)

**Decidido**
- Identificador do app: **`com.fizmusica.app`** (definitivo — o Flutter futuro tem que usar o mesmo).
- Abre em **`/minha-musica?origem=app`** (área do cliente; visitante vê a versão aberta).
- Host oficial: **`https://www.fizmusica.com.br`** — o endereço sem `www` responde 307 para ele. TWA e `assetlinks.json` usam o `www`.
- Conta Play Console **pessoal** (sem CNPJ). Com MEI, a mesma conta pode virar "empresa" (Sobre você → Alterar tipo de conta; exige D-U-N-S).
- No app, pagamento **só pelo Google Play** (ver seção de pagamento acima).

**No ar**
- `aab8a2c` — base do app: `app/manifest.ts`, ícones em `public/app/` (normal + maskable), `public/offline.html`, `public/sw.js` mínimo (só a página offline; não guarda páginas em cache de propósito), `RegistrarSW` só em produção, `/sw.js` sem cache, canal app/web por evento em `site_events.canal` (migração 065, aplicada).
- `3ce6af7` — exclusão de conta: Carreira → "Excluir minha conta" (confirma com EXCLUIR; bloqueia com música em produção), página pública **`/excluir-conta`** (URL do formulário da Play), e-mail de aviso. Pedidos pagos só perdem o vínculo; palmas viram autor anônimo.

**Aguardando**
- Verificação de identidade da conta pessoal no Play Console (pedida pelo Audrei em 2026-09-29).

**Próximos passos, nesta ordem**
1. Criar o app no Play Console (nome "Fiz Música", `com.fizmusica.app`) e ativar a assinatura gerenciada pelo Google.
2. Gerar o projeto TWA com Bubblewrap apontando para `https://www.fizmusica.com.br/manifest.webmanifest` (o Mac não tem Java/Android SDK — o Bubblewrap baixa). Cria a **chave de envio**: o Audrei define a senha e guarda em lugar seguro (sem ela não há atualização).
3. Publicar `/.well-known/assetlinks.json` com o SHA-256 da chave de assinatura que o Play Console mostra (sem isso aparece a barra do Chrome no topo).
4. Loja: textos, ícone 512, banner 1024×500, prints; formulário de segurança dos dados (link de exclusão acima); classificação indicativa.
5. Teste fechado: **12 testadores por 14 dias** (conta pessoal nova) antes da produção.
6. Depois: pagamento no app via Play Billing (fase 3) e push (opcional).

**Pendência legal:** a Política de Privacidade deve citar a exclusão de conta (e o login com Facebook, quando voltar).

## Onde paramos (2026-10-07)

**Feito**
- Conta pessoal no Play Console aprovada. App **"Fiz Música"** criado (pacote `com.fizmusica.app` registrado na criação, Grátis, pt-BR).
- Projeto Android gerado com Bubblewrap 1.25.0 em `android-app/` (fora do Git, no `.gitignore` junto com `*.keystore`/`*.jks`). Pacote: `android-app/app-release-bundle.aab`; APK de teste: `android-app/app-release-signed.apk`.
- **Chave de envio** em `~/FizMusica-Chave/fizmusica.keystore` (alias `fizmusica`), fora do projeto. Senha só com o dono — **perder a chave ou a senha impede atualizar o app**; manter cópia do arquivo e a senha no gerenciador.
- `public/.well-known/assetlinks.json` no ar, com o SHA-256 da chave de **envio** (validado na API Digital Asset Links do Google).

**Armadilhas vistas**
- O Bubblewrap sugere `br.com.fizmusica.www.twa` como Application ID: apagar e digitar `com.fizmusica.app`.
- Na primeira build ele fica em "Still waiting for package manifests" — está esperando aceitar a **licença** sem mostrar a pergunta: digitar `y` + Enter.

**Próximos passos**
1. Teste interno: salvar lista de testadores `Equipe` → **Criar nova versão** → aceitar a assinatura gerada pelo Google → upload do `.aab` → salvar.
2. **Integridade do app → Assinatura de apps:** copiar o SHA-256 da **chave de assinatura do app** (a do Google) e ACRESCENTAR no `assetlinks.json` (sem ele, o app baixado da loja abre com a barra do Chrome).
3. Instalar pelo link do teste interno num **Android** e conferir: abre sem barra do Chrome, login (magic link) volta para o app, tema e navegação.
4. Ficha da loja, segurança dos dados (link `https://www.fizmusica.com.br/excluir-conta`), classificação indicativa (público **18+**: TWA não pode mirar menores de 13).
5. Teste fechado com **12 testadores com Android por 14 dias**, depois pedir acesso à produção.

**Nova versão do app:** subir `appVersionCode` (e `appVersionName`) no `android-app/twa-manifest.json`, rodar `npx @bubblewrap/cli@1.25.0 update` e depois `build` (pede a senha da chave).
