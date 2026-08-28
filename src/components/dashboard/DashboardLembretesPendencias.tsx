import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DashboardMoneyText } from '@/components/dashboard/dashboard-money-visibility'
import { MetricRow } from '@/components/dashboard/dashboard-metric-row'
import type { DashboardRemindersSummary } from '@/lib/dashboard/daily-summary'
import {
	dashboardClientesAniversariosSemanaHref,
	dashboardFinanceiroHref,
	dashboardOsReceivableHref,
	dashboardVendasHojeHref,
} from '@/lib/dashboard/dashboard-links'

type Props = {
	dateStr: string
	reminders: DashboardRemindersSummary
	canSeePayables: boolean
	isAdmin: boolean
}

export function DashboardLembretesPendencias ({
	dateStr,
	reminders,
	canSeePayables,
	isAdmin,
}: Props) {
	const birthdayCount = reminders.birthdaysNext7DaysCount

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="mb-3 shrink-0 flex items-center gap-2">
				<Info className="h-4 w-4 text-sky-600" strokeWidth={1.75} />
				<h3 className="text-sm font-semibold text-foreground">Informações Adicionais</h3>
			</div>

			<div className={cn('divide-y divide-border/50')}>
				<MetricRow
					value={<DashboardMoneyText cents={reminders.averageTicketCents} />}
					label="Ticket Médio Do Dia"
					dotClass="bg-slate-400"
					href={dashboardVendasHojeHref(dateStr)}
				/>
				<MetricRow
					value={<DashboardMoneyText cents={reminders.openOsReceivableCents} />}
					label="OS Em Aberto"
					dotClass="bg-amber-500"
					href={dashboardOsReceivableHref(isAdmin)}
				/>
				{canSeePayables ? (
					<MetricRow
						value={<DashboardMoneyText cents={reminders.payablesTotalCents} />}
						label="Contas A Pagar"
						dotClass="bg-red-500"
						href={dashboardFinanceiroHref()}
					/>
				) : null}
				<MetricRow
					value={String(birthdayCount)}
					label="Aniversários > 7 Dias"
					dotClass="bg-pink-500"
					href={dashboardClientesAniversariosSemanaHref()}
				/>
			</div>
		</div>
	)
}
