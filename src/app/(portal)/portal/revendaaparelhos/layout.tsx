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

	return (
		<div className="space-y-4">
			<SeminovosSubmenu retailerMode={isRetailer} />
			{children}
		</div>
	)
}
