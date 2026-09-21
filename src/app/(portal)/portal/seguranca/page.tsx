import type { Metadata } from 'next'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import { SegurancaMfaClient } from './SegurancaMfaClient'

export const metadata: Metadata = {
	title: 'Segurança | Portal',
	robots: { index: false, follow: false },
}

export default function PortalSegurancaPage() {
	return (
		<div className="mx-auto w-full max-w-xl space-y-6">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">Segurança</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Proteja sua conta com autenticação em duas etapas (app autenticador).
				</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">Autenticação em duas etapas</CardTitle>
					<CardDescription>
						Compatível com Google Authenticator, Authy, 1Password e outros apps
						TOTP. A ativação é opcional; se ativar, o código será pedido no
						login.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<SegurancaMfaClient />
				</CardContent>
			</Card>
		</div>
	)
}
