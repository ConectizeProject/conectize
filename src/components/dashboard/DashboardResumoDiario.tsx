import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type {
	DashboardDevicesSummary,
	DashboardOsSummary,
	DashboardSalesSummary,
	DashboardBirthdayItem,
	DashboardReceivableItem,
} from '@/lib/dashboard/daily-summary'
import { DashboardLembretesPendencias } from '@/components/dashboard/DashboardLembretesPendencias'
import { DashboardResumoHeader } from '@/components/dashboard/DashboardResumoHeader'
import { DashboardMoneyText } from '@/components/dashboard/dashboard-money-visibility'
import {
	resumoInnerCardClassName,
	resumoOuterCardClassName,
} from '@/components/dashboard/resumo-card-styles'
import type { RecurringPendingDto } from '@/lib/finance/recurring-due'

type Props = {
	sales: DashboardSalesSummary
	os: DashboardOsSummary
	devices: DashboardDevicesSummary
	updatedAtLabel: string
	receivables: DashboardReceivableItem[]
	payables: RecurringPendingDto[]
	birthdays: DashboardBirthdayItem[]
	canSeePayables: boolean
}

function MetricRow ({
	value,
	label,
	dotClass,
	valueClass,
}: {
	value: ReactNode
	label: string
	dotClass: string
	valueClass?: string
}) {
	return (
		<div className="flex items-baseline gap-3 py-1.5">
			<span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotClass}`} aria-hidden />
			<span
				className={cn(
					'min-w-[4.5rem] text-base font-semibold tabular-nums tracking-tight sm:text-lg',
					valueClass || 'text-foreground',
				)}
			>
				{value}
			</span>
			<span className="text-sm text-muted-foreground">{label}</span>
		</div>
	)
}

export function DashboardResumoDiario ({
	sales,
	os,
	devices,
	updatedAtLabel,
	receivables,
	payables,
	birthdays,
	canSeePayables,
}: Props) {
	return (
		<section className={cn(resumoOuterCardClassName, 'p-4 sm:p-5')}>
			<DashboardResumoHeader updatedAtLabel={updatedAtLabel} />

			<div className="grid items-stretch gap-4 lg:grid-cols-3">
				<article className={resumoInnerCardClassName}>
					<h3 className="mb-3 text-sm font-semibold text-foreground">Vendas e OS</h3>
					<div className="divide-y divide-border/50">
						<MetricRow
							value={String(sales.salesCount)}
							label="Vendas"
							dotClass="bg-slate-400"
						/>
						<MetricRow
							value={String(sales.unitsSold)}
							label="Unidades vendidas"
							dotClass="bg-emerald-500"
						/>
						<MetricRow
							value={String(os.activeCount)}
							label="OS ativas"
							dotClass="bg-sky-500"
						/>
						<MetricRow
							value={String(os.finalizedTodayCount)}
							label="OS finalizadas"
							dotClass="bg-violet-500"
						/>
					</div>
				</article>

				<article className={resumoInnerCardClassName}>
					<h3 className="mb-3 text-sm font-semibold text-foreground">Aparelhos</h3>
					<div className="divide-y divide-border/50">
						<MetricRow
							value={String(devices.availableCount)}
							label="Disponíveis"
							dotClass="bg-sky-500"
						/>
						<MetricRow
							value={String(devices.soldTodayCount)}
							label="Vendidos"
							dotClass="bg-emerald-500"
						/>
						<MetricRow
							value={<DashboardMoneyText cents={devices.grossCents} />}
							label="Bruto"
							dotClass="bg-amber-500"
						/>
						<MetricRow
							value={<DashboardMoneyText cents={devices.netCents} />}
							label="Líquido"
							dotClass="bg-emerald-600"
							valueClass="text-emerald-700 dark:text-emerald-400"
						/>
					</div>
				</article>

				<div className={cn(resumoInnerCardClassName, 'min-h-[14rem]')}>
					<DashboardLembretesPendencias
						receivables={receivables}
						payables={payables}
						birthdays={birthdays}
						canSeePayables={canSeePayables}
						embedded
					/>
				</div>
			</div>
		</section>
	)
}
