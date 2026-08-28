'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Eye, EyeOff, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDashboardMoneyVisibility } from '@/components/dashboard/dashboard-money-visibility'

type Props = {
	updatedAtLabel: string
}

export function DashboardResumoHeader ({ updatedAtLabel }: Props) {
	const router = useRouter()
	const [isRefreshing, startTransition] = useTransition()
	const { hideMoney, toggleHideMoney } = useDashboardMoneyVisibility()

	function refreshDashboard () {
		startTransition(() => {
			router.refresh()
		})
	}

	return (
		<div className="mb-4 flex items-end justify-between gap-3">
			<h2 className="text-lg font-semibold tracking-tight">Resumo Diário</h2>
			<div className="flex items-center gap-1 text-muted-foreground">
				<button
					type="button"
					onClick={refreshDashboard}
					disabled={isRefreshing}
					className={cn(
						'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors',
						'hover:bg-accent hover:text-foreground',
						'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
						'disabled:pointer-events-none disabled:opacity-60',
					)}
					aria-label="Atualizar dashboard"
					title="Atualizar"
				>
					<RefreshCw
						className={cn('h-4 w-4', isRefreshing && 'animate-spin')}
						strokeWidth={1.75}
					/>
				</button>
				<p className="px-0.5 text-xs tabular-nums">{updatedAtLabel}</p>
				<button
					type="button"
					onClick={toggleHideMoney}
					className={cn(
						'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors',
						'hover:bg-accent hover:text-foreground',
						'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
					)}
					aria-label={hideMoney ? 'Mostrar valores monetários' : 'Ocultar valores monetários'}
					aria-pressed={hideMoney}
					title={hideMoney ? 'Mostrar valores' : 'Ocultar valores'}
				>
					{hideMoney ? (
						<EyeOff className="h-4 w-4" strokeWidth={1.75} />
					) : (
						<Eye className="h-4 w-4" strokeWidth={1.75} />
					)}
				</button>
			</div>
		</div>
	)
}
