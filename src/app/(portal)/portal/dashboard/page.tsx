import { redirect } from 'next/navigation'
import Link from 'next/link'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { getPortalOrganizationId } from '@/lib/organizations/portal-organization-context'
import { DashboardResumoDiario } from '@/components/dashboard/DashboardResumoDiario'
import { DashboardFaturamentoCard } from '@/components/dashboard/DashboardFaturamentoCard'
import { fetchDashboardDailySummary } from '@/lib/dashboard/daily-summary'
import { Button } from '@/components/ui/button'
import { ClipboardPlus, MonitorSmartphone } from 'lucide-react'
import { DashboardMoneyVisibilityProvider } from '@/components/dashboard/dashboard-money-visibility'

export const dynamic = 'force-dynamic'

function formatUpdatedAtLabel (now: Date): string {
	const time = new Intl.DateTimeFormat('pt-BR', {
		timeZone: 'America/Sao_Paulo',
		hour: '2-digit',
		minute: '2-digit',
	}).format(now)
	return `Hoje às ${time}`
}

function formatOperationalSubtitle (now: Date): string {
	const weekday = new Intl.DateTimeFormat('pt-BR', {
		timeZone: 'America/Sao_Paulo',
		weekday: 'long',
	}).format(now)
	const dayMonth = new Intl.DateTimeFormat('pt-BR', {
		timeZone: 'America/Sao_Paulo',
		day: 'numeric',
		month: 'long',
	}).format(now)
	return `Resumo operacional de ${weekday}, ${dayMonth}.`
}

export default async function DashboardPage () {
	const { user, role } = await getPortalAuth()
	if (!user) await redirectToPortalLogin()

	const normalizedRole = role === 'customer' ? 'user' : role
	if (normalizedRole === 'user') redirect('/portal/minhas-ordens')

	const supabase = await createSupabaseServerClient()
	const organizationId = await getPortalOrganizationId(supabase, user.id)
	if (!organizationId) redirect('/portal/ordens')

	const isAdminOrPlatform =
		normalizedRole === 'admin' || normalizedRole === 'platform_admin'
	const isStaffOrAdmin =
		normalizedRole === 'staff' ||
		normalizedRole === 'admin' ||
		normalizedRole === 'platform_admin'

	if (!isStaffOrAdmin) {
		return (
			<div className="space-y-2">
				<h1 className="text-2xl font-bold">Visão Geral</h1>
				<p className="text-sm text-muted-foreground">Sem dados para este perfil.</p>
			</div>
		)
	}

	const now = new Date()
	const summary = await fetchDashboardDailySummary(supabase, organizationId, {
		includeFinanceReminders: isAdminOrPlatform,
	})

	return (
		<DashboardMoneyVisibilityProvider>
			<div className="w-full space-y-6">
				<header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="min-w-0">
						<h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
							Visão Geral
						</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							{formatOperationalSubtitle(now)}
						</p>
					</div>
					<div className="flex shrink-0 flex-wrap items-center gap-2">
						<Button asChild className="shadow-sm">
							<Link href="/portal/ordens/nova" transitionTypes={['nav-forward']}>
								<ClipboardPlus className="h-4 w-4" strokeWidth={1.75} />
								Nova OS
							</Link>
						</Button>
						<Button asChild variant="outline" className="shadow-sm">
							<Link href="/portal/pdv" transitionTypes={['nav-forward']}>
								<MonitorSmartphone className="h-4 w-4" strokeWidth={1.75} />
								Frente de caixa
							</Link>
						</Button>
					</div>
				</header>

				<DashboardResumoDiario
					sales={summary.sales}
					os={summary.os}
					devices={summary.devices}
					updatedAtLabel={formatUpdatedAtLabel(now)}
					receivables={summary.receivables}
					payables={summary.payables}
					birthdays={summary.birthdays}
					canSeePayables={isAdminOrPlatform}
				/>

				<DashboardFaturamentoCard
					salesCents={summary.billingSalesCents}
					osCents={summary.billingOsCents}
					salesNetCents={summary.sales.netProfitCents}
					osNetCents={summary.os.netCents}
					salesGoalCents={summary.dailySalesGoalCents}
					osGoalCents={summary.dailyOsGoalCents}
				/>
			</div>
		</DashboardMoneyVisibilityProvider>
	)
}
