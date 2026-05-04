import type { Metadata } from 'next'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { getPortalAuth } from '@/lib/supabase/server'
import { SeminovosSubmenu } from '../seminovos/SeminovosSubmenu'

export const metadata: Metadata = {
	title: 'Aparelhos à venda · Portal',
}

export default async function RevendaAparelhosLayout({
	children,
}: {
	children: React.ReactNode
}) {
	const { user, role } = await getPortalAuth()
	if (!user) await redirectToPortalLogin()

	const normalizedRole = role === 'customer' ? 'user' : role
	const isRetailer = normalizedRole === 'retailer'
	const isAdmin =
		normalizedRole === 'admin' || normalizedRole === 'platform_admin'

	return (
		<div className="flex min-h-0 w-full flex-col">
			<div className="shrink-0 bg-background px-1 pt-1 sm:px-3">
				<SeminovosSubmenu
					retailerMode={isRetailer}
					showSeminovosNovosTabs={isAdmin}
				/>
			</div>
			<div className="min-h-0 w-full px-1 pt-3 sm:px-3">{children}</div>
		</div>
	)
}
