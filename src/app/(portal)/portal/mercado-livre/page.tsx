import { redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { MELI_PLATFORM_ID } from '@/lib/integrations/mercado-livre/constants'
import {
	createSupabaseServerClient,
	getPortalAuth,
} from '@/lib/supabase/server'
import { MeliAnunciosClient } from './MeliAnunciosClient'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{
	q?: string
	status?: string
	page?: string
}>

export default async function MercadoLivreAnunciosPage({
	searchParams,
}: {
	searchParams: SearchParams
}) {
	const sp = await searchParams
	const { user, role } = await getPortalAuth()
	if (!user) await redirectToPortalLogin()

	const normalizedRole = role === 'customer' ? 'user' : role
	if (normalizedRole === 'retailer') redirect('/portal/tabela-de-precos')
	if (
		normalizedRole !== 'staff' &&
		normalizedRole !== 'admin' &&
		normalizedRole !== 'platform_admin'
	) {
		redirect('/portal/minhas-ordens')
	}

	const supabase = await createSupabaseServerClient()
	const { data: connection } = await supabase
		.from('hub_connections')
		.select('id, metadata, token_expires_at')
		.eq('platform_id', MELI_PLATFORM_ID)
		.limit(1)
		.maybeSingle()

	const isAdmin =
		normalizedRole === 'admin' || normalizedRole === 'platform_admin'

	return (
		<div className="min-w-0 max-w-full space-y-4 sm:space-y-6">
			<div>
				<h1 className="text-xl font-bold tracking-tight sm:text-2xl">
					Anúncios Mercado Livre
				</h1>
				<p className="text-sm text-muted-foreground">
					Vitrine dos anúncios sincronizados da conta conectada no HUB.
				</p>
			</div>

			<MeliAnunciosClient
				isConnected={Boolean(connection)}
				isAdmin={isAdmin}
				initialQ={String(sp.q || '')}
				initialStatus={String(sp.status || 'all')}
				initialPage={Math.max(
					1,
					Number.parseInt(String(sp.page || '1'), 10) || 1,
				)}
			/>
		</div>
	)
}
