import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { McpActor } from '@/lib/mcp/actor'
import {
	atualizarCliente,
	buscarClientes,
	obterCliente,
} from '@/lib/mcp/customers'
import {
	atualizarStatusOrdem,
	buscarOrdens,
	comentarOrdem,
	obterOrdem,
} from '@/lib/mcp/orders'
import {
	atualizarProduto,
	buscarProdutos,
	obterProduto,
} from '@/lib/mcp/products'
import { ORDER_STATUS_VALUES } from '@/lib/orders/order-status'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

const CONFIRM =
	'Altera dados reais da organização da chave. Se o pedido for ambíguo, confirme com o usuário antes de chamar.'
const STATUSES = ORDER_STATUS_VALUES.join(', ')

export function createConectizeMcpServer(actor: McpActor) {
	const supabase = createSupabaseServiceClient()
	const server = new McpServer({ name: 'conectize', version: '1.0.0' })

	server.registerTool(
		'buscar_ordens',
		{
			description:
				'Busca até 20 ordens de serviço por número, nome do cliente, aparelho ou status.',
			inputSchema: {
				q: z
					.string()
					.optional()
					.describe('Número da OS, nome do cliente ou aparelho'),
				status: z.string().optional().describe(`Status opcional: ${STATUSES}`),
			},
			annotations: { readOnlyHint: true },
		},
		async (args) => buscarOrdens(supabase, actor, args),
	)

	server.registerTool(
		'obter_ordem',
		{
			description:
				'Detalhe curto de uma ordem de serviço pelo número de exibição ou pelo id.',
			inputSchema: {
				numero: z.string().optional().describe('Número de exibição da OS'),
				id: z.string().optional().describe('UUID da OS'),
			},
			annotations: { readOnlyHint: true },
		},
		async (args) => obterOrdem(supabase, actor, args),
	)

	server.registerTool(
		'atualizar_status_ordem',
		{
			description: `Atualiza só o status da OS. ${CONFIRM} Não ignora pendência de saída nem de garantia. Status: ${STATUSES}.`,
			inputSchema: {
				numero: z.string().optional().describe('Número de exibição da OS'),
				id: z.string().optional().describe('UUID da OS'),
				status: z.string().describe(`Novo status: ${STATUSES}`),
			},
			annotations: { readOnlyHint: false, destructiveHint: true },
		},
		async (args) => atualizarStatusOrdem(supabase, actor, args),
	)

	server.registerTool(
		'comentar_ordem',
		{
			description: `Grava um comentário interno na OS, visível para a equipe. ${CONFIRM}`,
			inputSchema: {
				numero: z.string().optional().describe('Número de exibição da OS'),
				id: z.string().optional().describe('UUID da OS'),
				texto: z.string().describe('Texto do comentário, até 6000 caracteres'),
			},
			annotations: { readOnlyHint: false },
		},
		async (args) => comentarOrdem(supabase, actor, args),
	)

	server.registerTool(
		'buscar_clientes',
		{
			description:
				'Busca até 20 clientes por nome ou pelos primeiros dígitos do CPF/CNPJ.',
			inputSchema: {
				q: z.string().describe('Nome (2+ caracteres) ou documento'),
			},
			annotations: { readOnlyHint: true },
		},
		async (args) => buscarClientes(supabase, actor, args),
	)

	server.registerTool(
		'obter_cliente',
		{
			description: 'Carrega um cliente pelo id, na organização da chave.',
			inputSchema: {
				id: z.string().describe('UUID do cliente'),
			},
			annotations: { readOnlyHint: true },
		},
		async (args) => obterCliente(supabase, actor, args),
	)

	server.registerTool(
		'atualizar_cliente',
		{
			description: `Atualiza nome, e-mail, telefone, contato ou endereço de um cliente. ${CONFIRM} CPF e CNPJ não mudam.`,
			inputSchema: {
				id: z.string().describe('UUID do cliente'),
				fullName: z.string().optional(),
				companyName: z.string().optional(),
				tradeName: z.string().optional(),
				email: z.string().optional(),
				phone: z.string().optional(),
				mobilePhone: z.string().optional(),
				contactPhone: z.string().optional(),
				contactNotes: z.string().optional(),
				addressFull: z.string().optional(),
				zipCode: z.string().optional(),
				state: z.string().optional(),
				city: z.string().optional(),
				neighborhood: z.string().optional(),
				street: z.string().optional(),
				streetNumber: z.string().optional(),
				streetComplement: z.string().optional(),
			},
			annotations: { readOnlyHint: false },
		},
		async (args) => atualizarCliente(supabase, actor, args),
	)

	server.registerTool(
		'buscar_produtos',
		{
			description:
				'Busca até 20 produtos por nome, SKU ou código de barras. Todas as palavras precisam aparecer.',
			inputSchema: {
				q: z.string().describe('Nome, SKU ou código de barras'),
			},
			annotations: { readOnlyHint: true },
		},
		async (args) => buscarProdutos(supabase, actor, args),
	)

	server.registerTool(
		'obter_produto',
		{
			description:
				'Carrega um produto pelo id ou pelo SKU, na organização da chave. Não devolve custo.',
			inputSchema: {
				id: z.string().optional().describe('UUID do produto'),
				sku: z.string().optional().describe('SKU exato'),
			},
			annotations: { readOnlyHint: true },
		},
		async (args) => obterProduto(supabase, actor, args),
	)

	server.registerTool(
		'atualizar_produto',
		{
			description: `Atualiza nome, SKU, código de barras, preço de venda (centavos) ou se o produto está ativo. ${CONFIRM} Não altera custo, fiscal nem estoque. O Bling não sincroniza por este canal.`,
			inputSchema: {
				id: z.string().describe('UUID do produto'),
				name: z.string().optional(),
				sku: z.string().optional(),
				barcode: z.string().optional(),
				salePriceCents: z
					.number()
					.int()
					.nonnegative()
					.optional()
					.describe('Preço de venda em centavos'),
				isActive: z.boolean().optional(),
			},
			annotations: { readOnlyHint: false },
		},
		async (args) => atualizarProduto(supabase, actor, args),
	)

	return server
}
