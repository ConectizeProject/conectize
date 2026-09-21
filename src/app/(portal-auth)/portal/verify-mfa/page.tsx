import { Suspense } from 'react'
import { VerifyMfaClient } from './VerifyMfaClient'

export default function PortalVerifyMfaPage() {
	return (
		<Suspense fallback={<div className="min-h-screen pt-32 pb-20" />}>
			<VerifyMfaClient />
		</Suspense>
	)
}
