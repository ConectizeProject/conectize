'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Bell, Cake, CircleDollarSign, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getOrdemPortalPath } from '@/lib/orders/ordem-portal-path'
import { DashboardMoneyText } from '@/components/dashboard/dashboard-money-visibility'
import type {
	DashboardBirthdayItem,
	DashboardReceivableGroup,
	DashboardReceivableItem,
} from '@/lib/dashboard/daily-summary'
import type { RecurringPendingDto } from '@/lib/finance/recurring-due'

type TabId = 'receber' | 'pagar' | 'aniversarios'

type Props = {
	receivables: DashboardReceivableItem[]
	payables: RecurringPendingDto[]
	birthdays: DashboardBirthdayItem[]
	canSeePayables: boolean
	embedded?: boolean
}

const TABS: Array<{ id: TabId; label: string; adminOnly?: boolean }> = [
	{ id: 'receber', label: 'A receber' },
	{ id: 'pagar', label: 'A pagar', adminOnly: true },
	{ id: 'aniversarios', label: 'Aniversários' },
]

const RECEIVABLE_GROUPS: Array<{
	id: DashboardReceivableGroup
	label: string
}> = [
	{ id: 'em_aberto', label: 'OS em aberto' },
	{ id: 'aguardando_retirada', label: 'OS aguardando retirada' },
	{ id: 'outros', label: 'Outros' },
]

export function DashboardLembretesPendencias ({
	receivables,
	payables,
	birthdays,
	canSeePayables,
	embedded = false,
}: Props) {
	const visibleTabs = TABS.filter((t) => !t.adminOnly || canSeePayables)
	const [tab, setTab] = useState<TabId>(visibleTabs[0]?.id ?? 'receber')

	const receivableSections = useMemo(() => {
		return RECEIVABLE_GROUPS.map((group) => ({
			...group,
			items: receivables.filter((item) => item.group === group.id),
		})).filter((section) => section.items.length > 0)
	}, [receivables])

	return (
		<div className={cn('flex h-full min-h-0 flex-col', embedded && 'h-full')}>
			<div className="mb-3 shrink-0 flex items-center gap-2">
				<Bell className="h-4 w-4 text-sky-600" strokeWidth={1.75} />
				<h3 className="text-sm font-semibold text-foreground">Lembretes e pendências</h3>
			</div>

			<div
				className="mb-3 shrink-0 flex gap-1 rounded-lg bg-white/80 p-0.5 dark:bg-slate-950/50"
				role="tablist"
				aria-label="Tipo de lembrete"
			>
				{visibleTabs.map((t) => (
					<button
						key={t.id}
						type="button"
						role="tab"
						aria-selected={tab === t.id}
						onClick={() => setTab(t.id)}
						className={cn(
							'flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors sm:text-xs',
							tab === t.id
								? 'bg-background text-foreground shadow-sm'
								: 'text-muted-foreground hover:text-foreground',
						)}
					>
						{t.label}
					</button>
				))}
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5 [scrollbar-gutter:stable]">
				{tab === 'receber' ? (
					receivableSections.length === 0 ? (
						<EmptyState
							icon={<CircleDollarSign className="h-7 w-7 text-muted-foreground/40" strokeWidth={1.5} />}
							message="Tudo em dia! Nenhum recebimento pendente."
						/>
					) : (
						<div className="space-y-4">
							{receivableSections.map((section) => (
								<section key={section.id} aria-labelledby={`receber-${section.id}`}>
									<div className="mb-2 flex items-center justify-between gap-2">
										<h4
											id={`receber-${section.id}`}
											className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
										>
											{section.label}
										</h4>
										<span className="text-[11px] tabular-nums text-muted-foreground">
											{section.items.length}
										</span>
									</div>
									<ul className="space-y-2">
										{section.items.map((item) => (
											<li key={item.id}>
												<Link
													href={getOrdemPortalPath({
														id: item.id,
														display_number: item.displayNumber,
													})}
													className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-white/60 px-2.5 py-2 text-sm transition-colors hover:bg-white dark:bg-slate-950/40 dark:hover:bg-slate-950/70"
												>
													<span className="min-w-0 truncate">
														{item.displayNumber ? `OS #${item.displayNumber}` : 'OS'}
														{' · '}
														<span className="text-muted-foreground">{item.label}</span>
													</span>
													<span className="shrink-0 font-medium tabular-nums text-amber-700 dark:text-amber-400">
														<DashboardMoneyText cents={item.openCents} />
													</span>
												</Link>
											</li>
										))}
									</ul>
								</section>
							))}
						</div>
					)
				) : null}

				{tab === 'pagar' ? (
					payables.length === 0 ? (
						<EmptyState
							icon={<Wallet className="h-7 w-7 text-muted-foreground/40" strokeWidth={1.5} />}
							message="Nenhuma conta a pagar neste critério."
						/>
					) : (
						<ul className="space-y-2">
							{payables.map((item) => (
								<li
									key={item.id}
									className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-white/60 px-2.5 py-2 text-sm dark:bg-slate-950/40"
								>
									<span className="min-w-0 truncate">
										{item.description}
										{item.conta_name ? (
											<span className="text-muted-foreground"> · {item.conta_name}</span>
										) : null}
									</span>
									<span className="shrink-0 font-medium tabular-nums text-red-600 dark:text-red-400">
										<DashboardMoneyText cents={item.amount_cents} />
									</span>
								</li>
							))}
							<li>
								<Link
									href="/portal/financeiro"
									className="text-xs font-medium text-sky-700 hover:underline dark:text-sky-300"
								>
									Ir para o financeiro →
								</Link>
							</li>
						</ul>
					)
				) : null}

				{tab === 'aniversarios' ? (
					birthdays.length === 0 ? (
						<EmptyState
							icon={<Cake className="h-7 w-7 text-muted-foreground/40" strokeWidth={1.5} />}
							message="Nenhum aniversariante hoje."
						/>
					) : (
						<ul className="space-y-2">
							{birthdays.map((item) => (
								<li
									key={item.id}
									className="flex items-center gap-2 rounded-lg border border-border/40 bg-white/60 px-2.5 py-2 text-sm dark:bg-slate-950/40"
								>
									<Cake className="h-4 w-4 shrink-0 text-pink-500" strokeWidth={1.75} />
									<span className="truncate font-medium">{item.name}</span>
								</li>
							))}
						</ul>
					)
				) : null}
			</div>
		</div>
	)
}

function EmptyState ({
	icon,
	message,
}: {
	icon: React.ReactNode
	message: string
}) {
	return (
		<div className="flex min-h-[8rem] flex-col items-center justify-center gap-2 px-3 text-center">
			{icon}
			<p className="text-sm text-muted-foreground">{message}</p>
		</div>
	)
}
