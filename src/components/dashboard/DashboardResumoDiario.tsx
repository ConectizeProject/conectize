import { cn } from '@/lib/utils'
import type {
	DashboardDevicesSummary,
	DashboardOsSummary,
	DashboardRemindersSummary,
	DashboardSalesSummary,
} from '@/lib/dashboard/daily-summary'
import {
	dashboardAparelhosBrutoLiquidoHref,
	dashboardAparelhosDisponiveisHref,
	dashboardAparelhosVendidosHojeHref,
	dashboardOrdensHref,
	dashboardVendasHojeHref,
} from '@/lib/dashboard/dashboard-links'
import { DashboardLembretesPendencias } from '@/components/dashboard/DashboardLembretesPendencias'
import { MetricRow } from '@/components/dashboard/dashboard-metric-row'
import { DashboardResumoHeader } from '@/components/dashboard/DashboardResumoHeader'
import { DashboardMoneyText } from '@/components/dashboard/dashboard-money-visibility'
import {
	resumoInnerCardClassName,
	resumoOuterCardClassName,
} from '@/components/dashboard/resumo-card-styles'

type Props = {
	dateStr: string
	sales: DashboardSalesSummary
	os: DashboardOsSummary
	devices: DashboardDevicesSummary
	updatedAtLabel: string
	reminders: DashboardRemindersSummary
	canSeePayables: boolean
	isAdmin: boolean
}

export function DashboardResumoDiario ({
	dateStr,
	sales,
	os,
	devices,
	updatedAtLabel,
	reminders,
	canSeePayables,
	isAdmin,
}: Props) {
	const brutoLiquidoHref = dashboardAparelhosBrutoLiquidoHref({ dateStr, isAdmin })

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
							href={dashboardVendasHojeHref(dateStr)}
						/>
						<MetricRow
							value={String(sales.unitsSold)}
							label="Unidades Vendidas"
							dotClass="bg-emerald-500"
						/>
						<MetricRow
							value={String(os.activeCount)}
							label="OS Ativas"
							dotClass="bg-sky-500"
							href={dashboardOrdensHref()}
						/>
						<MetricRow
							value={String(os.finalizedTodayCount)}
							label="OS Finalizadas"
							dotClass="bg-violet-500"
							href={dashboardOrdensHref()}
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
							href={dashboardAparelhosDisponiveisHref()}
						/>
						<MetricRow
							value={String(devices.soldTodayCount)}
							label="Vendidos"
							dotClass="bg-emerald-500"
							href={dashboardAparelhosVendidosHojeHref(dateStr)}
						/>
						<MetricRow
							value={<DashboardMoneyText cents={devices.grossCents} />}
							label="Bruto"
							dotClass="bg-amber-500"
							href={brutoLiquidoHref}
						/>
						<MetricRow
							value={<DashboardMoneyText cents={devices.netCents} />}
							label="Líquido"
							dotClass="bg-emerald-600"
							valueClass="text-emerald-700 dark:text-emerald-400"
							href={brutoLiquidoHref}
						/>
					</div>
				</article>

				<div className={cn(resumoInnerCardClassName, 'min-h-[14rem]')}>
					<DashboardLembretesPendencias
						dateStr={dateStr}
						reminders={reminders}
						canSeePayables={canSeePayables}
						isAdmin={isAdmin}
					/>
				</div>
			</div>
		</section>
	)
}
