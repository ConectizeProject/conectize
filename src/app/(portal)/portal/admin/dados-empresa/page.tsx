import { redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DocumentMaskedInput } from '@/app/(portal)/portal/clientes/DocumentMaskedInput'
import { DadosEmpresaSubmitButton } from './DadosEmpresaSubmitButton'
import { DadosEmpresaToastClient } from './DadosEmpresaToastClient'
import { OrganizationLogoFields } from './OrganizationLogoFields'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
import { formatCepBr } from '@/lib/utils/format-cep'
import { onlyDigits } from '@/lib/utils/strings'
import {
	ensurePortalOrganizationContext,
	getPortalOrganizationId,
} from '@/lib/organizations/portal-organization-context'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import {
	removeOrganizationLogoFolder,
	uploadOrganizationLogo,
} from '@/lib/organizations/organization-logo-storage'

async function canEditOrganizationData(
	supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
	userId: string,
	organizationId: string,
	userRole: string | null | undefined,
): Promise<boolean> {
	if (userRole === 'platform_admin') return true
	const { data: row } = await supabase
		.from('organization_members')
		.select('role_in_org')
		.eq('user_id', userId)
		.eq('organization_id', organizationId)
		.maybeSingle()
	return row?.role_in_org === 'admin'
}

async function updateCompanyAction(formData: FormData) {
	'use server'

	const supabase = await createSupabaseServerClient()
	const { user } = await getAuthUser()
	if (!user) await redirectToPortalLogin()

	const { data: me } = await supabase
		.from('users')
		.select('role')
		.eq('id', user.id)
		.maybeSingle()

	await ensurePortalOrganizationContext(supabase, user.id)
	const organizationId = await getPortalOrganizationId(supabase, user.id)
	if (!organizationId) redirect('/portal/ordens')

	const allowed = await canEditOrganizationData(
		supabase,
		user.id,
		organizationId,
		me?.role,
	)
	if (!allowed) redirect('/portal/ordens')

	const name = String(formData.get('name') || '').trim()
	const cnpj = onlyDigits(String(formData.get('cnpj') || '')).slice(0, 14) || null
	const address = String(formData.get('address') || '').trim() || null
	const complement = String(formData.get('complement') || '').trim() || null
	const zipCode = onlyDigits(String(formData.get('zipCode') || '')).slice(0, 8) || null
	const city = String(formData.get('city') || '').trim() || null
	const state = String(formData.get('state') || '').trim().slice(0, 2) || null
	const phone = String(formData.get('phone') || '').trim() || null
	const email = String(formData.get('email') || '').trim() || null
	const logoUrlField = String(formData.get('logoUrl') || '').trim() || null
	const logoFileRaw = formData.get('logoFile')
	const logoFile =
		logoFileRaw && typeof logoFileRaw !== 'string' && logoFileRaw.size > 0
			? logoFileRaw
			: null

	let nextLogoUrl = logoUrlField

	if (logoFile) {
		let svc
		try {
			svc = createSupabaseServiceClient()
		} catch {
			redirect('/portal/admin/dados-empresa?error=logo')
		}

		await removeOrganizationLogoFolder(svc, organizationId)
		const upload = await uploadOrganizationLogo(svc, organizationId, logoFile)
		if (!upload.ok) {
			redirect('/portal/admin/dados-empresa?error=logo')
		}
		nextLogoUrl = upload.publicUrl
	}

	await supabase
		.from('organizations')
		.update({
			name: name || null,
			cnpj,
			address,
			complement,
			zip_code: zipCode,
			city,
			state,
			phone,
			email,
			logo_url: nextLogoUrl,
			updated_at: new Date().toISOString(),
		})
		.eq('id', organizationId)

	redirect('/portal/admin/dados-empresa?ok=1')
}

export default async function DadosEmpresaPage({
	searchParams: _searchParams,
}: {
	searchParams: Promise<{ ok?: string }>
}) {
	const supabase = await createSupabaseServerClient()
	const { user } = await getAuthUser()
	if (!user) await redirectToPortalLogin()

	const { data: me } = await supabase
		.from('users')
		.select('role')
		.eq('id', user.id)
		.maybeSingle()

	await ensurePortalOrganizationContext(supabase, user.id)
	const organizationId = await getPortalOrganizationId(supabase, user.id)
	if (!organizationId) redirect('/portal/ordens')

	const allowed = await canEditOrganizationData(
		supabase,
		user.id,
		organizationId,
		me?.role,
	)
	if (!allowed) redirect('/portal/ordens')

	const { data: company } = await supabase
		.from('organizations')
		.select('*')
		.eq('id', organizationId)
		.maybeSingle()

	const c = company || {}

	return (
		<div className="space-y-6">
			<DadosEmpresaToastClient />
			<div className="max-w-2xl">
				<Card>
					<CardHeader>
						<CardTitle>Informações</CardTitle>
						<CardDescription>
							Estes dados aparecem no cabeçalho da impressão das ordens de serviço e no link público da OS.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form action={updateCompanyAction} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="name">Nome da empresa</Label>
								<Input
									id="name"
									name="name"
									defaultValue={String(c.name || '')}
									placeholder="Nome da assistência ou loja"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="cnpj">CPF ou CNPJ</Label>
								<DocumentMaskedInput
									name="cnpj"
									defaultValue={formatCpfCnpj(String(c.cnpj ?? ''))}
									placeholder="000.000.000-00 ou 00.000.000/0000-00"
								/>
							</div>

							<OrganizationLogoFields initialLogoUrl={String(c.logo_url || '')} />

							<div className="space-y-2">
								<Label htmlFor="address">Endereço</Label>
								<Input
									id="address"
									name="address"
									defaultValue={String(c.address || '')}
									placeholder="Rua, número"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="complement">Complemento</Label>
								<Input
									id="complement"
									name="complement"
									defaultValue={String(c.complement || '')}
									placeholder="Sala, andar, etc."
								/>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="zipCode">CEP</Label>
									<Input
										id="zipCode"
										name="zipCode"
										defaultValue={formatCepBr(c.zip_code)}
										placeholder="00000-000"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="city">Cidade</Label>
									<Input
										id="city"
										name="city"
										defaultValue={String(c.city || '')}
										placeholder="Belo Horizonte"
									/>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="state">Estado (UF)</Label>
									<Input
										id="state"
										name="state"
										defaultValue={String(c.state || '')}
										placeholder="MG"
										maxLength={2}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="phone">Telefone</Label>
									<Input
										id="phone"
										name="phone"
										defaultValue={String(c.phone || '')}
										placeholder="(31) 99999-9999"
									/>
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="email">E-mail</Label>
								<Input
									id="email"
									name="email"
									type="email"
									defaultValue={String(c.email || '')}
									placeholder="contato@empresa.com.br"
								/>
							</div>

							<DadosEmpresaSubmitButton />
						</form>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
