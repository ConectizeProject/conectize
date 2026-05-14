import Link from 'next/link'
import { redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
		customersQuery.or(`cpf.eq.${documentDigits},cnpj.eq.${documentDigits}`)
	}

	const { data: customers } = await customersQuery

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
					<CardDescription>
						{customers && customers.length > 0 ? `${customers.length} clientes` : 'Nenhum cliente encontrado.'}
					</CardDescription>
				</CardHeader>
				<CardContent>
					{customers && customers.length > 0 ? (
						<ClientesTableClient customers={(customers ?? []) as CustomerRow[]} />
					) : (
						<div className="text-sm text-muted-foreground">
							Nenhum cliente encontrado.
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	)
}

