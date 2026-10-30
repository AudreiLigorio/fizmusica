import { z } from "zod"

// Campos editáveis de um produto, EM UM LUGAR SÓ.
//
// Existiam dois schemas quase idênticos — um na criação
// (`/api/admin/produtos`) e outro na edição (`/api/admin/produtos/[id]`) — e
// manter os dois em dia era tarefa de ninguém. Em 29/10/2026 isso cobrou:
// os campos do pacote pré-pago foram adicionados só no de criação, e editar
// o produto no admin salvava tudo MENOS eles.
//
// O que torna esse erro traiçoeiro é o Zod descartar campo não declarado em
// SILÊNCIO: o formulário mandava `credit_price`, o schema jogava fora, o
// update salvava o resto e a tela dizia que deu certo. Nenhum erro em lugar
// nenhum — só o valor que não ficava. (O mesmo já tinha acontecido com a
// referência de estilo do wizard, ver lib/validators/order.ts.)
//
// Daqui pra frente: campo novo entra AQUI e as duas rotas ganham juntas.
export const camposDoProduto = {
  name:        z.string().min(1),
  description: z.string().optional(),
  price:       z.number().positive(),
  active:      z.boolean().optional(),
  featured:    z.boolean().optional(),
  category:    z.enum(["DIGITAL", "DIGITAL_PHYSICAL"]).optional(),
  weight_g:    z.number().int().positive().nullable().optional(),
  height_cm:   z.number().int().positive().nullable().optional(),
  width_cm:    z.number().int().positive().nullable().optional(),
  length_cm:   z.number().int().positive().nullable().optional(),
  photo_limit: z.number().int().min(0).optional(),
  // Recursos do plano (migração 042).
  feat_lyrics_sync: z.boolean().optional(),
  feat_qrcode:      z.boolean().optional(),
  feat_download:    z.boolean().optional(),
  feat_revision:    z.boolean().optional(),
  // Pacote pré-pago (migração 071). Os dois papéis são independentes:
  //   credits_granted > 0  → comprar este produto DÁ créditos: é um pacote
  //   credit_price   > 0   → este produto PODE ser pago com crédito
  credits_granted: z.number().int().min(0).optional(),
  credit_price:    z.number().int().positive().nullable().optional(),
  // Migração 076. Falso em pacote de crédito: cupom ali multiplica o valor
  // do desconto pelo tamanho do pacote.
  aceita_cupom:    z.boolean().optional(),
}

// Criação: identificador obrigatório (vira a PK e fica gravado em
// orders.productId), nome e preço obrigatórios.
export const criarProdutoSchema = z.object({
  id: z.string().min(2).max(60)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use apenas letras minúsculas, números e hífens."),
  ...camposDoProduto,
})

// Edição: tudo opcional, e o identificador NÃO entra — mudá-lo quebraria o
// vínculo de todo pedido já vendido naquele plano.
export const editarProdutoSchema = z.object(camposDoProduto).partial()
