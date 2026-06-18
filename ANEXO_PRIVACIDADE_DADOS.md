# Anexo — Inventário de Dados Pessoais (apoio à Política de Privacidade)

> **Aviso:** este documento é um **inventário técnico** dos dados que o sistema FizMusica coleta e armazena, para apoiar a redação da Política de Privacidade. **Não é parecer jurídico.** As colunas "base legal" e "retenção" são **sugestões** que devem ser **validadas por um advogado/DPO** antes da publicação — especialmente nos pontos sinalizados com ⚠️.

Controlador: **FizMusica** · Contato do titular: **contato@fizmusica.com.br** · Domínio: **fizmusica.com.br**

---

## 1. Dados coletados

| Dado | Onde é armazenado | Finalidade | Base legal sugerida (LGPD Art. 7) | Retenção sugerida |
|---|---|---|---|---|
| **Nome** | `orders`, conta | Identificar o cliente, personalizar a música e a comunicação | Execução de contrato (V) | Enquanto durar a relação + prazo legal |
| **E-mail** | `orders`, `auth.users`, `order_claims` | Login, envio do pedido/música, suporte | Execução de contrato (V) | Idem |
| **WhatsApp/telefone** | `orders` | Contato sobre o pedido e entrega | Execução de contrato (V) | Idem |
| **Respostas do wizard (história)** ⚠️ | `order_answers`, `wizard_sessions` | Produzir a letra/música personalizada | Execução de contrato (V) | Enquanto necessário à entrega + período de suporte |
| **Nome do homenageado** ⚠️ (dado de terceiro) | `orders`, `generated_music` | Personalizar a música para a pessoa homenageada | Legítimo interesse (IX) / consentimento (I) | Idem ao pedido |
| **Endereço de entrega** (produtos físicos) | `orders` (shipping_*) | Enviar o produto físico | Execução de contrato (V) | Enquanto necessário + obrigação fiscal |
| **Fotos enviadas pelo cliente** ⚠️ (imagem de pessoas; possíveis crianças) | `order_photos` + Storage `order-photos` | Exibir no player da música | **Consentimento (I)** | Até remoção pelo cliente / fim da conta |
| **Dados de pagamento** (ids da transação) | `payments`, `payment_alerts` | Processar pagamento, conciliação, antifraude | Execução de contrato (V) + obrigação legal/fiscal (II) | Prazo fiscal (ex.: 5 anos) |
| **Conta / login** (e-mail; nome e foto se Google) | `auth.users` (Supabase Auth) | Autenticar o acesso à área do cliente | Execução de contrato (V) / consentimento no Google (I) | Enquanto a conta existir |
| **Sessão do wizard** (nome/e-mail/respostas em JSON) | `wizard_sessions` | Permitir retomar/recuperar pedido não finalizado | Legítimo interesse (IX) | Curta (sugerido 30–90 dias) |
| **Avaliação pós-entrega** (nota, comentários) | `feedbacks` | Melhorar o produto/serviço | Legítimo interesse (IX) | Enquanto útil para análise |
| **Música gerada** (letra, nome, MP3, imagem) | `generated_music` + Storage `songs` | Entregar o produto adquirido | Execução de contrato (V) | Enquanto a conta/relação existir |
| **Logs e alertas operacionais** | `payment_alerts`, logs de aplicação | Segurança, prevenção a fraude/duplicidade | Legítimo interesse (IX) / obrigação legal (II) | Período de auditoria |

⚠️ **Pontos que exigem atenção do jurídico:**
- **Fotos de pessoas** podem incluir **crianças/adolescentes** → tratamento exige cuidado redobrado e, em regra, **consentimento dos pais/responsáveis** (ECA + LGPD Art. 14).
- **Campos de texto livre** (história) podem conter, por iniciativa do cliente, **dados sensíveis** (saúde, religião, etc.) → mencionar na política e orientar o cliente.
- **Dado de terceiro** (homenageado) → o cliente declara ter autorização para usá-lo.

---

## 2. Operadores / sub-processadores (terceiros)

O FizMusica compartilha dados, na medida necessária, com prestadores que atuam como **operadores**:

| Terceiro | Papel | Dados envolvidos | Localização |
|---|---|---|---|
| **Supabase** (AWS) | Banco de dados, autenticação e armazenamento de arquivos | Praticamente todos os dados + fotos | **EUA (us-west-1)** ⚠️ |
| **Vercel** | Hospedagem da aplicação/APIs | Tráfego e processamento | EUA (região padrão) |
| **Mercado Pago** | Processamento de pagamento | Nome, e-mail, dados da transação | Brasil |
| **Resend** | Envio de e-mails transacionais | Nome, e-mail | EUA |
| **Google** (OAuth) | Login social opcional | E-mail, nome, foto de perfil | EUA |
| **n8n Cloud** | Automação de eventos (futuro WhatsApp) | Dados do pedido | Nuvem (conforme contratação) |

⚠️ **Transferência internacional de dados:** banco, contas e **fotos dos clientes** ficam em servidores nos **EUA** (Supabase/AWS). A política deve **informar a transferência internacional** e a base que a autoriza (LGPD Art. 33).

---

## 3. Cookies e tecnologias de sessão

- **Sessão do cliente** (Supabase Auth) — mantém o login (sem senha) no navegador.
- **Cookie do admin** — autenticação do painel interno (httpOnly).
- **Mercado Pago (Checkout Bricks)** — pode usar cookies/scripts próprios para o pagamento e antifraude.

---

## 4. Direitos do titular (LGPD Art. 18)

O cliente pode solicitar: **confirmação e acesso**, **correção**, **anonimização/eliminação**, **portabilidade**, **informação sobre compartilhamento** e **revogação de consentimento**. Canal: **contato@fizmusica.com.br**.

Mecanismos já existentes no produto que apoiam esses direitos:
- **Correção de e-mail** do pedido (suporte/admin).
- **Remoção de fotos** pelo próprio cliente na sua área.
- **Acesso** aos próprios pedidos/dados via área do cliente (login).

---

## 5. Segurança aplicada (resumo para a política)

- Conexão **HTTPS** em todo o site.
- **Autenticação sem senha** (link mágico/Google) — reduz risco de vazamento de senha.
- **Validação rigorosa de uploads** (tipo real do arquivo por assinatura, limite de tamanho, sem formatos executáveis).
- **Confirmação de pagamento no servidor** (não no navegador) e **alertas de duplicidade**.
- **Controle de acesso por linha (RLS)** no banco; acesso sensível restrito ao backend.

---

*Documento técnico de apoio. Recomenda-se revisão por advogado/DPO antes de publicar a Política de Privacidade, com atenção especial aos itens ⚠️ (fotos/menores, dados sensíveis em texto livre, transferência internacional).*
