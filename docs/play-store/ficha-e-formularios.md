# Play Store — ficha e formulários do app Fiz Música

Respostas para o Play Console (app `com.fizmusica.app`), preparadas em 2026-10-07 a partir do que o site realmente coleta. **Se o site passar a coletar algo novo, atualizar a "Segurança dos dados"** — declaração diferente da realidade é motivo de remoção do app.

Imagens nesta pasta: `icone-512.png` (ícone 512×512) e `banner-1024x500.png` (recurso gráfico). Capturas de tela do celular: tirar no Android de teste (mín. 2, formato vertical).

---

## 1. Ficha principal da loja (Aumentar número de usuários → Presença na loja → Ficha principal)

**Nome do app** (até 30): `Fiz Música`

**Descrição curta** (até 80):
```
Músicas personalizadas para presentear. Conte a história, a gente compõe.
```

**Descrição completa** (até 4000):
```
Transforme uma história real em uma música feita só para quem você ama.

No Fiz Música você conta a história — um aniversário, um casamento, uma homenagem para a mãe, o pai, os avós, um pedido de namoro, um chá revelação ou até a despedida de um pet — e nós compomos uma música personalizada, com letra exclusiva e o estilo que você escolher: sertanejo, pagode, MPB, pop, rock, gospel e muito mais.

COMO FUNCIONA
1. Escolha a ocasião e responda algumas perguntas sobre a história.
2. Escolha o estilo musical e o plano.
3. Aprove a letra e, se quiser, envie fotos.
4. Receba a música pronta para presentear, com player exclusivo, capa e QR Code.

O QUE VOCÊ RECEBE
• Música personalizada com letra exclusiva
• Capa exclusiva e segunda versão grátis
• Letra sincronizada no player
• Retrospectiva com fotos sincronizadas à música (planos Retrospectiva)
• Cartão com QR Code para presentear (plano Premium)

REDE FIZ MÚSICA
Ouça músicas reais que outros clientes escolheram publicar, aplauda as que emocionam, favorite e monte suas playlists.

SUA CARREIRA DE CANTOR
A cada música criada você ganha discos, sobe de nível e paga menos na próxima.

Para quem compõe: também dá para enviar a sua própria letra e escolher o estilo para virar música.

Fiz Música — Sua história. Sua música.
```

**Ícone do app**: `docs/play-store/icone-512.png`
**Recurso gráfico**: `docs/play-store/banner-1024x500.png`
**Capturas de tela do smartphone**: mínimo 2 (sugestão: Home, wizard "Para quem é essa música?", escolha do produto, Rede, player de uma música).

**Categoria** (Configurações da loja): Tipo **App** · Categoria **Música e áudio**
**Detalhes de contato**: e-mail `contato@fizmusica.com.br` · site `https://www.fizmusica.com.br`

---

## 2. Conteúdo do app (Política → Conteúdo do app)

| Item | Resposta |
|---|---|
| **Política de privacidade** | `https://www.fizmusica.com.br/legal/politica-de-privacidade` |
| **Anúncios** | **Não**, o app não contém anúncios |
| **Acesso ao app** | **Todas ou algumas funcionalidades são restritas** → instruções abaixo |
| **Classificação do conteúdo** | questionário abaixo |
| **Público-alvo e conteúdo** | **18 anos ou mais** (só essa faixa). Não é voltado para crianças |
| **Apps de notícias** | Não |
| **App governamental** | Não |
| **Recursos financeiros** | Nenhum (o app vende um produto; não é serviço financeiro) |
| **Saúde** | Nenhum |
| **ID de publicidade** | **Não** usa ID de publicidade |

**Instruções de acesso** (para o revisor do Google):
```
O app abre sem login: a Rede Fiz Música (músicas publicadas) e a criação de uma música funcionam para visitantes.
A área do cliente (Pedidos, Carreira, playlists) exige conta. Para criar uma, toque em "Entrar" e use "Entrar com Google" (qualquer conta Google) ou receba o link de acesso por e-mail. Não há usuário e senha especiais.
```

### Classificação do conteúdo (questionário IARC)
- E-mail de contato: `contato@fizmusica.com.br`
- Categoria: **Todos os outros tipos de app** (não é jogo, não é rede social/comunicação)
- Violência, medo, sexualidade, linguagem imprópria, drogas, jogos de azar: **Não** em todos
- **Os usuários podem interagir ou trocar conteúdo?** **Sim**: clientes podem publicar suas músicas na Rede para outros ouvirem (não há chat nem mensagens entre usuários)
- **Compartilha a localização do usuário com outros usuários?** Não
- **Compras digitais?** **Sim** (músicas personalizadas)

---

## 3. Segurança dos dados (Política → Conteúdo do app → Segurança dos dados)

**Visão geral**
- O app coleta ou compartilha algum dos tipos de dados obrigatórios? **Sim**
- Todos os dados coletados são criptografados em trânsito? **Sim** (HTTPS)
- Os usuários podem solicitar a exclusão dos dados? **Sim** → URL: `https://www.fizmusica.com.br/excluir-conta`
- Dados **compartilhados** com terceiros: **Não**. Os fornecedores que processam dados em nosso nome (hospedagem, banco de dados, e-mail, pagamento, geração da música) não contam como compartilhamento pelas regras do Google, e a publicação de uma música na Rede é feita pelo próprio usuário.

**Tipos de dados coletados**

| Categoria → tipo | Coletado | Obrigatório? | Finalidades |
|---|---|---|---|
| Informações pessoais → **IDs do usuário** (id da conta) | Sim | Obrigatório | Funcionalidade do app; Gerenciamento de contas |
| Informações pessoais → **Nome** | Sim | Obrigatório | Funcionalidade do app; Gerenciamento da conta |
| Informações pessoais → **Endereço de e-mail** | Sim | Obrigatório | Funcionalidade do app; Gerenciamento de contas; Mensagens do desenvolvedor; **Publicidade ou marketing** (recuperação de carrinho, lembrete de data especial, envio em massa do CRM) |
| Informações pessoais → **Número de telefone** (WhatsApp) | Sim | Obrigatório | Funcionalidade do app; Comunicações do desenvolvedor |
| Informações pessoais → **Endereço** (só plano com entrega física) | Sim | Opcional | Funcionalidade do app |
| Informações financeiras → **Informações de pagamento do usuário** (cartão/PIX, pelo Mercado Pago) | Sim | Obrigatório | Funcionalidade do app; Prevenção contra fraudes |
| Informações financeiras → **Histórico de compras** | Sim | Obrigatório | Funcionalidade do app |
| Localização → **Localização aproximada** (estado, pelo IP) | Sim | Obrigatório | Análise |
| Fotos e vídeos → **Fotos** (enviadas para a retrospectiva) | Sim | Opcional | Funcionalidade do app |
| Mensagens/conteúdo → **Outros conteúdos gerados pelo usuário** (respostas sobre a história, letra, título, playlists, datas especiais) | Sim | Obrigatório | Funcionalidade do app |
| Atividade no app → **Interações com o app** (páginas, reproduções, aplausos, favoritos) | Sim | Obrigatório | Análise; Funcionalidade do app |
| Informações e desempenho do app → **Registros de falhas** e **Diagnóstico** (Sentry, sem dados pessoais) | Sim | Obrigatório | Análise |
| IDs do dispositivo ou outros → **IDs de dispositivo ou outros** (identificador anônimo de sessão) | Sim | Obrigatório | Análise |

Para cada tipo, o formulário pergunta se o dado é **processado temporariamente**: responder **Não** (fica guardado).

**Personalização**: não marcada em nenhum tipo (a Rede mostra rankings gerais, não recomendação individual). Se isso mudar, atualizar.

**Não coletados**: localização precisa, contatos, agenda, arquivos, áudio (o microfone do wizard só transforma fala em texto no próprio navegador; o áudio não é enviado ao Fiz Música), saúde, mensagens SMS/e-mail, histórico de navegação na web.
