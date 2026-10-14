export type PortalNavItem = {
	href: string
	label: string
	/** Rotas que começam com href, mas pertencem a outro item do menu. */
	excludePrefixes?: string[]
}

export type PortalNavGroup = {
	label: string
	items: PortalNavItem[]
}

export type PortalNavConfig = {
	groups: PortalNavGroup[]
	directLinks: PortalNavItem[]
}

type BuildPortalNavParams = {
	role: string
	isAdmin: boolean
	hasWhatsappIntegration: boolean
}

function group(label: string, items: PortalNavItem[]): PortalNavGroup {
	return { label, items }
}

export function buildPortalNavConfig({
	role,
	isAdmin,
}: BuildPortalNavParams): PortalNavConfig {
	const normalizedRole = role === 'customer' ? 'user' : role
	const isBasicUser = normalizedRole === 'user' || !normalizedRole
	const isRetailer = normalizedRole === 'retailer'
	const isStaff = normalizedRole === 'staff'

	if (isBasicUser) {
		return {
			groups: [],
			directLinks: [{ href: '/portal/minhas-ordens', label: 'Minhas ordens' }],
		}
	}

	if (isRetailer) {
		return {
			groups: [
				group('Comercial', [
					{ href: '/portal/tabela-de-precos', label: 'Tabela de preços' },
					{ href: '/portal/revendaaparelhos', label: 'Aparelhos à venda' },
				]),
			],
			directLinks: [
				{ href: '/portal/minhas-ordens', label: 'Minhas ordens' },
				{ href: '/portal/financeiro-lojista', label: 'Financeiro' },
			],
		}
	}

	if (normalizedRole === 'accountant') {
		return {
			groups: [
				group('Notas fiscais', [
					{ href: '/portal/contador/nfce', label: 'NFC-e' },
					{ href: '/portal/contador/nfe', label: 'NF-e' },
				]),
			],
			directLinks: [],
		}
	}

	const cadastros: PortalNavItem[] = [
		{ href: '/portal/produtos', label: 'Produtos e serviços' },
		{ href: '/portal/mercado-livre', label: 'Anúncios' },
		{ href: '/portal/clientes', label: 'Clientes' },
	]
	if (!isStaff && isAdmin) {
		cadastros.push({ href: '/portal/admin/usuarios', label: 'Usuários' })
	}
	cadastros.push(
		{ href: '/portal/revendaaparelhos', label: 'Aparelhos' },
		{ href: '/portal/fornecedores', label: 'Fornecedores' },
		{ href: '/portal/notas-fiscais-entrada', label: 'Notas fiscais de entrada' },
		{ href: '/portal/checkin-recebimento', label: 'Check-in de recebimento' },
	)

	const groups: PortalNavGroup[] = [
		group('Vendas', [
			{ href: '/portal/pdv', label: 'Frente de caixa' },
			{ href: '/portal/ordens', label: 'Ordens de serviço' },
			{ href: '/portal/orcamentos', label: 'Orçamentos' },
			{
				href: '/portal/vendas',
				label: 'Pedidos de Venda',
				excludePrefixes: [
					'/portal/vendas/checkout',
					'/portal/vendas/nfe',
					'/portal/vendas/nfce',
				],
			},
			{ href: '/portal/vendas/checkout', label: 'Checkout de pedidos' },
			{ href: '/portal/vendas/nfe', label: 'NF-e' },
			{ href: '/portal/vendas/nfce', label: 'NFC-e' },
		]),
		group('Cadastros', cadastros),
	]

	if (!isStaff && isAdmin) {
		groups.push(
			group('Financeiro', [
				{
					href: '/portal/financeiro',
					label: 'Gestão Financeira',
					excludePrefixes: [
						'/portal/financeiro/dre',
						'/portal/financeiro/bancos',
						'/portal/financeiro/comissoes',
						'/portal/financeiro/formas-pagamento',
					],
				},
				{ href: '/portal/financeiro/dre', label: 'DRE' },
				{ href: '/portal/financeiro/bancos', label: 'Caixas e Bancos' },
				{ href: '/portal/financeiro/comissoes', label: 'Comissões' },
			]),
		)
	}

	groups.push(
		group('Mensagens', [
			{ href: '/portal/whatsapp', label: 'WhatsApp' },
			{ href: '/portal/mensagens/perguntas', label: 'Perguntas' },
			{ href: '/portal/mensagens/vendas', label: 'Mensagens de venda' },
			{ href: '/portal/mensagens/reclamacoes', label: 'Reclamações' },
			{ href: '/portal/mensagens/prontas', label: 'Mensagens prontas' },
		]),
	)

	if (!isStaff && isAdmin) {
		groups.push(
			group('Meu negócio', [
				{ href: '/portal/meu-negocio/curva-abc', label: 'Curva ABC' },
				{ href: '/portal/hub', label: 'HUB' },
				{ href: '/portal/relatorios', label: 'Relatórios' },
			]),
		)
	}

	return { groups, directLinks: [] }
}

export function isPortalNavItemActive(pathname: string, item: PortalNavItem): boolean {
	const { href, excludePrefixes } = item
	if (excludePrefixes?.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
		return false
	}
	if (href === '/portal') return pathname === '/portal'
	if (href === '/portal/dashboard') return pathname === '/portal/dashboard'
	return pathname === href || pathname.startsWith(`${href}/`)
}

export function isPortalNavGroupActive(
	pathname: string,
	items: PortalNavItem[],
): boolean {
	return items.some((item) => isPortalNavItemActive(pathname, item))
}
