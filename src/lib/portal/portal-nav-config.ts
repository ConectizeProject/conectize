export type PortalNavItem = {
	href: string
	label: string
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

function group (label: string, items: PortalNavItem[]): PortalNavGroup {
	return { label, items }
}

export function buildPortalNavConfig ({
	role,
	isAdmin,
	hasWhatsappIntegration,
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

	const operacoesItems: PortalNavItem[] = [
		{ href: '/portal/ordens', label: 'Ordens de serviço' },
	]

	if (hasWhatsappIntegration) {
		operacoesItems.push({ href: '/portal/whatsapp', label: 'WhatsApp' })
	}

	const groups: PortalNavGroup[] = [
		group('Operações', operacoesItems),
		group('Cadastros', [
			{ href: '/portal/produtos', label: 'Produtos e serviços' },
			{ href: '/portal/clientes', label: 'Clientes' },
			{ href: '/portal/revendaaparelhos', label: 'Aparelhos à venda' },
		]),
		group('Vendas', [
			{ href: '/portal/pdv', label: 'Frente de caixa' },
			{ href: '/portal/vendas', label: 'Vendas' },
		]),
	]

	if (!isStaff && isAdmin) {
		groups.push(
			group('Administração', [
				{ href: '/portal/admin/usuarios', label: 'Usuários' },
				{ href: '/portal/hub', label: 'HUB' },
				{ href: '/portal/financeiro', label: 'Financeiro' },
				{ href: '/portal/admin/financeiro-lojas', label: 'Financeiro lojas' },
				{ href: '/portal/relatorios/servicos', label: 'Relatórios' },
			]),
		)
	}

	return { groups, directLinks: [] }
}

export function isPortalNavItemActive (pathname: string, href: string): boolean {
	if (href === '/portal') return pathname === '/portal'
	if (href === '/portal/dashboard') return pathname === '/portal/dashboard'
	return pathname === href || pathname.startsWith(`${href}/`)
}

export function isPortalNavGroupActive (
	pathname: string,
	items: PortalNavItem[],
): boolean {
	return items.some((item) => isPortalNavItemActive(pathname, item.href))
}
