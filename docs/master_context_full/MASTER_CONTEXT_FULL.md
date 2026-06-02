# MASTER_CONTEXT_FULL.md

# FIZ MÚSICA

## Versão 1.0

---

# 1. VISÃO DO PRODUTO

## O que é o Fiz Música

O Fiz Música é uma plataforma de experiências emocionais personalizadas.

O objetivo da plataforma é transformar histórias, homenagens, momentos especiais e sentimentos em músicas personalizadas.

O cliente não compra apenas uma música.

O cliente compra:

* emoção
* memória
* homenagem
* surpresa
* experiência

Projeto principal: Fiz Música.

Manter como projeto prioritário.

Todo contexto futuro deve considerar este projeto como referência principal.

---

## Posicionamento

Transformamos histórias em músicas inesquecíveis.

---

## Proposta de Valor

Permitir que qualquer pessoa transforme uma história pessoal em uma música exclusiva.

---

## Diferencial

O diferencial não é a tecnologia.

O diferencial é a experiência emocional.

---

# 2. OBJETIVOS DO MVP

## Objetivo Principal

Validar a operação comercial do Fiz Música.

---

## O MVP deve permitir

* Criar pedido
* Receber pagamento
* Gerar briefing
* Gerar prompt
* Produzir música
* Publicar música
* Gerar QR Code
* Entregar música

---

## O MVP NÃO precisa

* Marketplace
* Área social
* Sistema de afiliados
* Gamificação
* Aplicativo nativo
* Produção automatizada por IA

---

# 3. ARQUITETURA CONCEITUAL

## Fluxo Principal

Cliente

↓

Wizard

↓

Produto

↓

Pagamento

↓

Prompt

↓

Produção

↓

Música

↓

QR Code

↓

Entrega

---

## Princípios Arquiteturais

### Princípio 1

Uma música gera um pedido.

Um pedido gera uma música.

---

### Princípio 2

Comprador e homenageado são entidades distintas.

---

### Princípio 3

O MP3 é um ativo permanente.

---

### Princípio 4

A URL pública é um recurso temporário.

---

### Princípio 5

Toda produção nasce de um prompt.

---

# 4. PÚBLICO-ALVO

## Principal

Pessoas procurando presentes emocionais.

---

## Casos de Uso:
Qual o tipo de homenagem?

### Amor

* Pedido de namoro
* Pedido de casamento
* Casamento
* Reconciliação
* Dia dos Namorados

---

### Família

* Mãe
* Pai
* Filho
* Filha
* Avós
* Irmãos

---

### Gravidez & Bebê

* Contar para o Marido
* Descoberta da gravidez
* Chá revelação
* Nascimento

---

### Conquistas

* Formatura
* Promoção
* Aprovação
* Novo negócio

---

### Outros

* Gratidão
* Saudade
* Tributos

---

### Pets

* Homenagem
* Despedida

Fluxo Oficial do Wizard

1. Escolha a Ocasião
2. Escolha do Tipo da História
3. Para Quem é a Música
4. Conte sua História
5. Continuação Emocional
6. Estilo Musical
7. Emoção Desejada
8. Informações Extras
9. Revisão
10. Enviando
11. Confirmação
12. Acompanhar Pedido
13. Música Pronta

---

# 5. UX E DESIGN SYSTEM

## Filosofia

Mobile First.

---

## Objetivo

Uma experiência emocional e simples.

---

## Referências

* Typeform
* Airbnb
* Duolingo
* Headspace
* Spotify

---

## Regras

### Uma decisão por tela

O usuário nunca deve tomar múltiplas decisões simultaneamente.

---

### Pouca digitação

Priorizar:

* Cards
* Botões
* Seleções

---

### Progressão clara

Sempre mostrar evolução do processo.

---

## Identidade Visual

Preservar:

* Nome Fiz Música
* Logo atual
* Paleta de cores atual

---

## Permitido

Refatorar totalmente:

* Layout
* Navegação
* Componentes
* Fluxos

---

## Conceitos Visuais

* Premium
* Emocional
* Humano
* Elegante
* Minimalista

---

# 6. STACK OFICIAL

## Frontend

* Next.js
* TypeScript
* Tailwind
* shadcn/ui
* Radix UI

---

## Backend

* Supabase

---

## Banco

* PostgreSQL (Supabase)

---

## E-mail

* Resend

---

## Automações

* n8n

---

## Pagamentos

* Mercado Pago

---

## Hospedagem

* Vercel

---

## DNS / CDN / SSL

* Cloudflare

---

## Versionamento

* GitHub

---

# 7. JORNADA DO CLIENTE

## Fluxo

Landing

↓

Wizard

↓

Produto

↓

Checkout

↓

Pagamento

↓

Produção

↓

Entrega

---

## Login

Não obrigatório antes da compra.

---

## Após compra

O cliente poderá acessar sua área privada.

---

## Autenticação

Permitida:

* Google
* Magic Link
* E-mail

Preparar arquitetura para futuras integrações.

---

# 8. JORNADA DO HOMENAGEADO

## Conceito

O homenageado não precisa possuir conta.

---

## Acesso

QR Code

ou

URL pública

---

## Experiência

Abrir página pública.

Ouvir música.

Ler mensagem.

Visualizar homenagem.

---

# 9. DOMÍNIO CLIENTE

## Conceito

Pessoa responsável pela compra.

---

## Responsabilidades

* Criar pedido
* Efetuar pagamento
* Receber música

---

## Pode possuir

Múltiplas músicas.

---

## Pode realizar

Múltiplos pedidos.

---

# 10. DOMÍNIO HOMENAGEADO

## Conceito

Pessoa que recebe a homenagem.

---

## Pode receber

* Música
* QR Code
* URL pública

---

## Pode ser

Diferente do comprador.

---

## Pode futuramente

Tornar-se cliente.

---

# 11. DECISÕES CONGELADAS

✅ 1 música = 1 pedido

✅ Comprador ≠ Homenageado

✅ WhatsApp canal principal

✅ Wizard parametrizável

✅ Produtos parametrizáveis

✅ Prompt automático

✅ Produção baseada em prompt

✅ MP3 permanente

✅ URL pública temporária

✅ QR Code único

✅ Mobile First

✅ Cloudflare + Vercel

✅ Supabase como backend principal

---

FIM DA PARTE 1


# MASTER_CONTEXT_FULL.md

# PARTE 2

---

# 12. DOMÍNIO WIZARD

## Objetivo

O Wizard é o coração do negócio.

Toda experiência começa nele.

---

## Conceito

O Wizard transforma uma história emocional em um briefing estruturado.

---

## Arquitetura

Ocasião

↓

Subcategoria

↓

Perguntas

↓

Respostas

↓

Briefing

↓

Prompt

---

## Requisitos

### Parametrizável

Nenhuma alteração deve exigir deploy.

---

### Versionável

Toda alteração gera nova versão.

---

### Auditável

Todo pedido deve armazenar a versão utilizada.

---

## Estrutura

### Ocasiões

Exemplos:

* Amor
* Família
* Gravidez & Bebê
* Conquistas
* Datas Especiais
* Outros
* Pets

---

### Subcategorias

Exemplos:

Amor

↓

Pedido de Namoro

Pedido de Casamento

Reconciliação

Casamento

---

## Tipos de Perguntas

* Texto Curto
* Texto Longo
* Seleção Única
* Múltipla Escolha
* Data
* Upload
* Áudio

---

## Administração

O Admin poderá:

* Criar ocasião
* Editar ocasião
* Ativar ocasião
* Desativar ocasião

---

Também poderá:

* Criar subcategorias
* Reordenar perguntas
* Ativar perguntas
* Desativar perguntas

---

## Preview

O Admin poderá simular o Wizard antes da publicação.

---

## Versionamento

Exemplo:

Wizard v1.0

↓

Wizard v1.1

↓

Wizard v2.0

---

Pedidos antigos permanecem vinculados à versão original.

---

# 13. DOMÍNIO PRODUTO

## Objetivo

Representar aquilo que será vendido.

---

## Produtos Iniciais

### Música Digital

Produto de entrada.

---

### Box Premium

Produto físico + digital.

---

### Box Experience

Produto premium completo.

---

## Parametrização

Todo produto deve ser configurável.

---

## Campos

* Nome
* Descrição
* Ativo
* Destaque
* Ordem

---

## Prazos

Devem ser configuráveis.

Exemplo:

* 24h
* 48h
* 72h
* 7 dias

---

## Urgência

Cada urgência poderá alterar o preço.

---

## Ativação

Admin poderá:

* Ativar
* Desativar
* Ocultar

---

# 14. DOMÍNIO PEDIDO

## Conceito

O pedido é a entidade central do sistema.

---

## Regra Principal

1 Música

=

1 Pedido

---

## Estrutura

Pedido

↓

Cliente

↓

Produto

↓

Briefing

↓

Pagamento

↓

Produção

↓

Entrega

---

## Status

Draft

Pending Payment

Paid

Producing

Published

Delivered

Closed

---

## Histórico

Todo evento deve gerar rastreabilidade.

---

## Entrega

Opções:

### Buyer

Apenas comprador.

---

### Buyer And Honoree

Comprador e homenageado.

---

### Honoree

Somente homenageado.

---

# 15. DOMÍNIO MÚSICA

## Conceito

A música é o ativo principal da plataforma.

---

## Componentes

* MP3
* Letra
* Mensagem
* QR Code
* URL Pública

---

## Regra Principal

MP3 nunca deve ser apagado automaticamente.

---

## Publicação

Publicar significa:

* Criar URL
* Criar QR Code
* Disponibilizar acesso

---

## Página Pública

Permite acesso ao homenageado.

---

## Área do Cliente

Permite acesso ao comprador.

---

## Expurgo

Pode remover:

* Página pública
* URL pública
* QR Code

---

## Não pode remover

* MP3
* Letra
* Pedido

---

## Reenvio

Permitido.

Poderá ser cobrado futuramente.

---

# 16. ACESSO PÚBLICO

## Objetivo

Compartilhar a homenagem.

---

## Componentes

URL Pública

↓

QR Code

↓

Página Pública

---

## Administração

Admin poderá:

* Visualizar URL
* Copiar URL
* Desativar URL
* Restaurar URL

---

## Histórico

Registrar:

* Quem desativou
* Quando desativou
* Motivo

---

# 17. ENTREGA

## Conceito

Entrega é independente da publicação.

---

## Canais

### Principal

WhatsApp

---

### Secundário

E-mail

---

## Destinatários

Comprador

Homenageado

Ambos

---

## Publicação

Após publicar:

* Gerar URL
* Gerar QR Code
* Enviar conforme configuração

---

# 18. DECISÕES CONGELADAS

✅ Wizard totalmente parametrizável

✅ Versionamento obrigatório

✅ Preview obrigatório

✅ Produto parametrizável

✅ Urgência parametrizável

✅ Prazo parametrizável

✅ 1 Música = 1 Pedido

✅ MP3 permanente

✅ URL pública expurgável

✅ QR Code único

✅ Entrega configurável

✅ WhatsApp principal

---

FIM DA PARTE 2

# MASTER_CONTEXT_FULL.md

# PARTE 3

---

# 19. DOMÍNIO PRODUÇÃO

## Objetivo

Transformar um briefing em uma música publicada.

---

## Conceito

A Produção é a fábrica operacional do Fiz Música.

---

## Fluxo Oficial

Pagamento Aprovado

↓

Gerar Prompt

↓

Fila de Produção

↓

Produção

↓

Upload MP3

↓

Upload Letra

↓

Publicação

↓

QR Code

↓

Entrega

---

## Geração de Prompt

Automática.

---

## Gatilho

Pagamento aprovado.

---

## Regras

Todo pedido pago deve gerar:

* Prompt
* Registro de Produção

---

## Prompt

O Prompt é um ativo do sistema.

---

## Objetivos

* Padronização
* Rastreabilidade
* Evolução futura

---

## Estrutura

Briefing

↓

Prompt

↓

Produção

---

## Fila de Produção

Ordem:

1. Urgência
2. Data do Pagamento

---

## Status Produção

Waiting

Assigned

In Production

Uploaded

Published

---

## Atribuição

MVP:

Manual.

---

## Perfil

Produção

---

## Publicação

Ao publicar:

* Criar Música
* Criar URL
* Criar QR Code
* Atualizar Pedido
* Registrar Histórico
* Disparar Entrega

---

# 20. DOMÍNIO CRM

## Objetivo

Gerenciar relacionamento.

---

## Conceitos

Lead

Cliente

Homenageado

Cliente Recorrente

---

## Jornada

Visitante

↓

Lead

↓

Cliente

↓

Cliente Recorrente

↓

Embaixador

---

## Pipeline

Novo Lead

↓

Wizard Iniciado

↓

Wizard Concluído

↓

Checkout

↓

Compra

↓

Entrega

↓

Recompra

---

## Cliente

Histórico completo.

---

## Informações

* Nome
* E-mail
* WhatsApp
* Compras
* Valor Total
* Última Compra

---

## Homenageado

Também é uma entidade CRM.

---

## Objetivo Futuro

Permitir que homenageados se tornem clientes.

---

# 21. DOMÍNIO ADMIN

## Objetivo

Centralizar operação.

---

## Menus Principais

Dashboard

Pedidos

Produção

Músicas

Produtos

Wizard

CRM

Usuários

Relatórios

Configurações

---

# Dashboard

Indicadores:

* Receita
* Pedidos
* Produção
* SLA

---

# Pedidos

Visualização completa.

---

## Ações

* Visualizar
* Filtrar
* Alterar Status
* Reenviar

---

# Produtos

CRUD completo.

---

# Wizard

Módulo estratégico.

---

## Gerenciar

* Ocasiões
* Subcategorias
* Perguntas
* Opções
* Versionamento

---

# Produção

Fila operacional.

---

# CRM

Leads

Clientes

Homenageados

---

# Música

Gerenciar:

* URL
* QR Code
* Expurgo
* Reenvio

---

# Usuários

Perfis:

Admin

Atendimento

Produção

---

# Relatórios

Conversão

Receita

Produção

SLA

---

# 22. BANCO DE DADOS

## Filosofia

Banco é a fonte oficial da verdade.

---

## Entidades

customers

honorees

briefs

products

product_delivery_options

orders

payments

production_prompts

songs

music_public_access

deliveries

users

wizard_occasions

wizard_subcategories

wizard_questions

wizard_question_options

order_status_history

---

## Convenções

UUID

created_at

updated_at

soft delete quando necessário

snake_case

---

## Segurança

Row Level Security obrigatório.

---

# 23. INTEGRAÇÕES

## Supabase

Responsável por:

* Auth
* Banco
* Storage

---

## Resend

Responsável por:

* E-mails
* Templates

---

## n8n

Responsável por:

* Automações
* Workflows

---

## Mercado Pago

Responsável por:

* Checkout
* Pagamentos
* Webhooks

---

## Vercel

Responsável por:

* Deploy
* Hospedagem

---

## Cloudflare

Responsável por:

* DNS
* SSL
* CDN
* Segurança

---

## GitHub

Responsável por:

* Versionamento
* Histórico

---

# 24. FASE 0.5 - VALIDAÇÃO DA STACK

## Objetivo

Validar toda arquitetura antes do desenvolvimento.

---

## Testes

GitHub

Vercel

Cloudflare

Supabase

Resend

n8n

Mercado Pago

Storage

QR Code

---

## Página Health

/health

---

## Deve exibir

Application

Database

Email

Storage

Webhook

Version

---

# 25. REGRAS CLAUDE CODE

## Arquitetura

Next.js App Router

---

## Linguagem

TypeScript obrigatório.

---

## Regras

Sem any.

---

## Formulários

React Hook Form

Zod

---

## UI

shadcn/ui

Radix UI

---

## Componentização

Obrigatória.

---

## Mobile First

Obrigatório.

---

## Acessibilidade

WCAG AA.

---

## Performance

Lazy Loading

Code Splitting

Image Optimization

---

## Documentação

Toda tarefa deve atualizar:

PROGRESS.md

Documentação impactada

---

# 26. ROADMAP OFICIAL

FASE 0

Arquitetura

✅

---

FASE 0.5

Validação Stack

---

FASE 1

Estrutura Técnica

---

FASE 2

Banco

---

FASE 3

Admin

---

FASE 4

Wizard Manager

---

FASE 5

Produtos

---

FASE 6

Jornada Cliente

---

FASE 7

Produção

---

FASE 8

Entrega

---

FASE 9

CRM

---

FASE 10

Automações

---

# 27. FORA DO ESCOPO MVP

Marketplace

Rede Social

Afiliados

Aplicativo Nativo

Gamificação

Produção IA Totalmente Automática

Chat Interno

Sistema de Tickets

---

# 28. MISSÃO DO PROJETO

Transformar histórias em músicas inesquecíveis.

---

# 29. REGRA MAIS IMPORTANTE

O sucesso do projeto não será medido pela quantidade de funcionalidades.

Será medido pela facilidade com que uma pessoa consegue:

1. Escolher uma ocasião
2. Contar sua história
3. Comprar
4. Receber sua música
5. Compartilhar a emoção

---

FIM DO MASTER_CONTEXT_FULL.md V1.0

# MASTER_CONTEXT_FULL.md

# COMPLEMENTO V2 - 40% OPERACIONAL

---

# 30. ÁREA DO CLIENTE

## Objetivo

A Área do Cliente é a biblioteca pessoal do comprador.

Todo comprador autenticado poderá acessar todas as músicas adquiridas ao longo do tempo.

---

## Dashboard

Exibir:

* Nome do cliente
* Quantidade de músicas adquiridas
* Última compra
* Última música publicada
* Pedidos em andamento

---

## Minhas Músicas

Listagem completa.

Cada item deverá apresentar:

* Capa
* Ocasião
* Nome do homenageado
* Data
* Status

---

## Detalhes da Música

Exibir:

* Player
* Letra
* QR Code
* URL pública
* Data de criação
* Histórico

---

## Ações

* Ouvir música
* Baixar MP3
* Baixar QR Code
* Copiar URL pública
* Solicitar suporte

---

## Histórico

O cliente poderá visualizar todas as músicas já adquiridas.

Não existe limite de pedidos.

---

# 31. EXPERIÊNCIA DO HOMENAGEADO

## Objetivo

Transformar a entrega em uma experiência emocional.

---

## Regra Principal

A página pública não deve parecer um sistema.

Deve parecer um presente.

---

## Estrutura

Mensagem

↓

Foto (opcional)

↓

Player

↓

Letra

↓

Encerramento

---

## Não Exibir

* Número do pedido
* Valor pago
* Dados administrativos
* Dados internos

---

## Pode Exibir

* Nome do homenageado
* Mensagem personalizada
* Música
* Letra

---

# 32. MODELO OPERACIONAL DE PRODUÇÃO

## Objetivo

Garantir rastreabilidade.

---

## Fluxo

Pagamento

↓

Prompt

↓

Fila

↓

Produção

↓

Upload

↓

Publicação

↓

Entrega

---

## SLA

Opções iniciais:

* 24h
* 48h
* 72h
* 7 dias

---

## Responsável

Toda produção deverá possuir:

* assigned_to
* assigned_at

---

## Métricas

Produção deve acompanhar:

* Tempo médio
* Tempo por produtor
* Pedidos atrasados
* Pedidos concluídos

---

# 33. WIZARD EMOCIONAL

## Amor

Subcategorias:

* Pedido de namoro
* Pedido de casamento
* Casamento
* Reconciliação
* Aniversário de namoro
* Dia dos Namorados

---

## Família

Subcategorias:

* Mãe
* Pai
* Filho
* Filha
* Avós
* Irmãos
* Sobrinha
* Sobrinho

---

## Gravidez & Bebê

Subcategorias:

* Descoberta da gravidez
* Chá revelação
* Nascimento
* Você vai ser vovó
* Você vai ser vovô

---

## Conquistas

Subcategorias:

* Formatura
* Promoção
* Aprovação
* Novo negócio

---

## Homenagens

Subcategorias:

* Gratidão
* Saudade
* Tributo

---

## Pets

Subcategorias:

* Homenagem
* Despedida

---

# 34. WIZARD MANAGER

## Objetivo

Permitir evolução do produto sem deploy.

---

## Administração

Gerenciar:

* Ocasiões
* Subcategorias
* Perguntas
* Opções
* Fluxos
* Versões

---

## Publicação

Fluxo obrigatório:

Rascunho

↓

Publicar

↓

Produção

---

## Preview

Permitir testar a experiência antes da publicação.

---

## Auditoria

Registrar:

* Usuário
* Data
* Versão

---

# 35. REGRAS DE ENTREGA

## Buyer

Entrega somente ao comprador.

---

## Buyer And Honoree

Entrega ao comprador e ao homenageado.

---

## Honoree

Entrega diretamente ao homenageado.

---

## Canais

Principal:

WhatsApp

Secundário:

E-mail

---

# 36. RETENÇÃO E EXPURGO

## Nunca Remover

* MP3
* Letra
* Prompt
* Pedido
* Histórico

---

## Pode Expurgar

* Página pública
* URL pública
* QR Code

---

## Pode Restaurar

* Página pública
* URL pública
* QR Code

---

## Auditoria

Registrar:

* Quem removeu
* Quando removeu
* Motivo

---

# 37. CRM OPERACIONAL

## Cliente

Armazenar:

* Compras
* Valor total
* Última compra
* Produtos adquiridos

---

## Homenageado

Armazenar:

* Homenagens recebidas
* Última homenagem
* Quantidade de homenagens

---

## Objetivo Futuro

Converter homenageados em compradores.

---

# 38. PERMISSÕES ADMINISTRATIVAS

## Admin

Acesso total.

---

## Atendimento

Acesso:

* Pedidos
* Clientes
* CRM

Sem acesso técnico.

---

## Produção

Acesso:

* Fila
* Prompt
* Upload
* Publicação

---

# 39. VALIDAÇÃO DA STACK

## Obrigatória antes do desenvolvimento

Validar:

* GitHub
* Vercel
* Cloudflare
* Supabase
* Resend
* n8n
* Mercado Pago
* Storage
* QR Code

---

## Página Health

/health

---

## Deve exibir

* Application
* Database
* Email
* Storage
* Webhook
* Version

---

## Critério

Nenhum módulo funcional poderá ser iniciado antes da aprovação da Fase 0.5.

---

# 40. PRINCÍPIO OPERACIONAL FINAL

O sucesso do Fiz Música não será medido pela quantidade de funcionalidades.

Será medido pela facilidade com que alguém consegue:

1. Escolher uma ocasião
2. Contar sua história
3. Comprar
4. Receber sua música
5. Compartilhar emoção com outra pessoa

---

FIM DO COMPLEMENTO V2

