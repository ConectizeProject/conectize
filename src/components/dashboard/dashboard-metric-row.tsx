import type { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export function MetricRow ({
	value,
	label,
	dotClass,
	valueClass,
	href,
}: {
	value: ReactNode
	label: string
	dotClass: string
	valueClass?: string
	href?: string
}) {
	const inner = (
		<>
			<span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotClass}`} aria-hidden />
			<span
				className={cn(
					'min-w-[5.5rem] text-base font-semibold tabular-nums tracking-tight sm:min-w-[6.5rem] sm:text-lg',
					valueClass || 'text-foreground',
				)}
			>
				{value}
			</span>
			<span className={cn('text-sm text-muted-foreground', href && 'underline-offset-2 group-hover:underline')}>
				{label}
			</span>
		</>
	)

	if (href) {
		return (
			<Link
				href={href}
				transitionTypes={['nav-forward']}
				className="group flex items-baseline gap-3 rounded-md py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				{inner}
			</Link>
		)
	}

	return (
		<div className="flex items-baseline gap-3 py-1.5">
			{inner}
		</div>
	)
}
