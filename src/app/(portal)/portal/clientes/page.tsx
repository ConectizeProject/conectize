import Link from 'next/link'
import { redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCpf, formatCnpj } from '@/lib/utils/format-cpf-cnpj'
import { ClientesTableClient, type CustomerRow } from './ClientesTableClient'
import { ClientesFilterCard } from './ClientesFilterCard'

export const dynamic = 'force-dynamic'

function normalizeCpf(value: string) {
	return value.replace(/\D/g, '').trim()
}

type SearchParams = Promise<{ q?: string; document?: string }>

export default async function ClientesPage({
	searchParams,
}: {
	searchParams: SearchParams
}) {
	const { q, document } = await searchParams
	const query = String(q || '').trim()
	const documentDigits = normalizeCpf(String(document || ''))

	const { user, role } = await getPortalAuth()
	if (!user) await redirectToPortalLogin()

	const normalizedRole = role === 'customer' ? 'user' : role
	if (normalizedRole === 'user') redirect('/portal/minhas-ordens')

	const supabase = await createSupabaseServerClient()

	const customersQuery = supabase
		.from('customers')
		.select('id, cpf, cnpj, is_company, full_name, company_name, email, phone, auth_user_id')
		.order('created_at', { ascending: false })
		.limit(50)

	if (query) {
		const escaped = query.replaceAll(',', ' ')
		customersQuery.or(`full_name.ilike.%${escaped}%,company_name.ilike.%${escaped}%,email.ilike.%${escaped}%`)
	}

	if (documentDigits) {
		// Aceita documento só dígitos ou legado mascarado (000.000.000-00).
		const cpfMasked = documentDigits.length === 11 ? formatCpf(documentDigits) : ''
		const cnpjMasked = documentDigits.length === 14 ? formatCnpj(documentDigits) : ''
		const orParts = [
			`cpf.eq.${documentDigits}`,
			`cnpj.eq.${documentDigits}`,
			cpfMasked ? `cpf.eq.${cpfMasked}` : null,
			cnpjMasked ? `cnpj.eq.${cnpjMasked}` : null,
			documentDigits.length >= 5 ? `cpf.like.${documentDigits}%` : null,
			documentDigits.length >= 5 ? `cnpj.like.${documentDigits}%` : null,
		].filter(Boolean)
		customersQuery.or(orParts.join(','))
	}

	const { data: customers, error: customersError } = await customersQuery
	if (customersError) {
		console.error('[portal/clientes] list query failed', {
			message: customersError.message,
			code: customersError.code,
			details: customersError.details,
			hint: customersError.hint,
			q: query,
			document: documentDigits,
		})
	}

	const rows = (customers ?? []) as CustomerRow[]
	const hasActiveFilter = Boolean(query || documentDigits)
	const resultsLabel =
		rows.length > 0
			? `${rows.length} cliente${rows.length === 1 ? '' : 's'}`
			: hasActiveFilter
				? 'Nenhum cliente encontrado para os filtros.'
				: 'Nenhum cliente cadastrado ainda.'

	return (
		<div className="space-y-6">
			<div className="flex items-end justify-between gap-4 flex-wrap">
				<div>
					<h1 className="text-2xl font-bold">Clientes</h1>
					<p className="text-sm text-muted-foreground">
						Busca rápida (até 50 resultados).
					</p>
				</div>
				<Button variant="outline" asChild>
					<Link href="/portal/clientes/novo">Novo cliente</Link>
				</Button>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Buscar</CardTitle>
					<CardDescription>
						Filtre por nome/e-mail ou CPF/CNPJ.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<ClientesFilterCard
						initialQ={query}
						initialDocumentDigits={documentDigits}
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Resultados</CardTitle>
					<CardDescription>{resultsLabel}</CardDescription>
				</CardHeader>
				<CardContent>
					{rows.length > 0 ? (
						<ClientesTableClient customers={rows} />
					) : null}
				</CardContent>
			</Card>
		</div>
	)
}

