export function dashboardVendasHojeHref (dateStr: string): string {
	const p = new URLSearchParams()
	p.set('status', 'paid')
	p.set('from', dateStr)
	p.set('to', dateStr)
	return `/portal/vendas?${p.toString()}`
}

export function dashboardOrdensHref (): string {
	return '/portal/ordens'
}

export function dashboardAparelhosDisponiveisHref (): string {
	return '/portal/revendaaparelhos'
}

export function dashboardAparelhosVendidosHojeHref (dateStr: string): string {
	const p = new URLSearchParams()
	p.set('sold', '1')
	p.set('saleDateFrom', dateStr)
	p.set('saleDateTo', dateStr)
	return `/portal/revendaaparelhos?${p.toString()}`
}

export function dashboardAparelhosBrutoLiquidoHref (opts: {
	dateStr: string
	isAdmin: boolean
}): string {
	if (opts.isAdmin) {
		const p = new URLSearchParams()
		p.set('from', opts.dateStr)
		p.set('to', opts.dateStr)
		return `/portal/relatorios/vendas-aparelhos?${p.toString()}`
	}
	return dashboardAparelhosVendidosHojeHref(opts.dateStr)
}

export function dashboardFinanceiroOsHref (): string {
	return '/portal/financeiro?source=os'
}

export function dashboardFinanceiroOsHojeHref (dateStr: string): string {
	const p = new URLSearchParams()
	p.set('source', 'os')
	p.set('from', dateStr)
	p.set('to', dateStr)
	return `/portal/financeiro?${p.toString()}`
}

export function dashboardFaturamentoOsHref (opts: {
	dateStr: string
	isAdmin: boolean
}): string {
	return opts.isAdmin
		? dashboardFinanceiroOsHojeHref(opts.dateStr)
		: dashboardOrdensHref()
}

export function dashboardFinanceiroHref (): string {
	return '/portal/financeiro'
}

export function dashboardOsReceivableHref (isAdmin: boolean): string {
	return isAdmin ? dashboardFinanceiroOsHref() : dashboardOrdensHref()
}

export function dashboardClientesAniversariosSemanaHref (): string {
	return '/portal/clientes?birthdaysWeek=1'
}
