import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ClientesTableClient } from './ClientesTableClient'
import { DocumentMaskedInput } from './DocumentMaskedInput'

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

	const supabase = await createSupabaseServerClient()
	const { user } = await getAuthUser()
	if (!user) redirect('/portal/login')

	const { data: appUser } = await supabase
		.from('users')
		.select('role')
		.eq('id', user.id)
		.maybeSingle()

	const role = appUser?.role || 'user'
	const normalizedRole = role === 'customer' ? 'user' : role
	if (normalizedRole === 'user') redirect('/portal/minhas-ordens')

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
					<form action="/portal/clientes" method="get" className="grid gap-4 md:grid-cols-3">
						<div className="space-y-2 md:col-span-2">
							<Label htmlFor="q">Nome / e-mail</Label>
							<Input id="q" name="q" defaultValue={query} placeholder="Ex: Maria, cliente@exemplo.com" />
						</div>
						<div className="space-y-2">
							<Label htmlFor="document">CPF/CNPJ</Label>
							<div id="document">
								<DocumentMaskedInput name="document" defaultValue={documentDigits} placeholder="000.000.000-00" />
							</div>
						</div>
						<div className="md:col-span-3 flex items-center gap-3 flex-wrap">
							<Button type="submit">Buscar</Button>
							<Button variant="outline" asChild>
								<Link href="/portal/clientes">Limpar</Link>
							</Button>
						</div>
					</form>
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
						<ClientesTableClient customers={customers as any} />
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

