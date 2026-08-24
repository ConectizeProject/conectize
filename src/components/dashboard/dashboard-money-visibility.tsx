'use client'

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from 'react'
import { formatCentsBr } from '@/lib/utils/format-money'

const STORAGE_KEY = 'portal-dashboard-hide-money'

type DashboardMoneyVisibilityContextValue = {
	hideMoney: boolean
	toggleHideMoney: () => void
	formatMoney: (cents: number) => string
}

const DashboardMoneyVisibilityContext =
	createContext<DashboardMoneyVisibilityContextValue | null>(null)

export function DashboardMoneyVisibilityProvider ({
	children,
}: {
	children: React.ReactNode
}) {
	const [hideMoney, setHideMoney] = useState(false)

	useEffect(() => {
		try {
			setHideMoney(window.localStorage.getItem(STORAGE_KEY) === '1')
		} catch {
			// ignore
		}
	}, [])

	const toggleHideMoney = useCallback(() => {
		setHideMoney((prev) => {
			const next = !prev
			try {
				window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
			} catch {
				// ignore
			}
			return next
		})
	}, [])

	const formatMoney = useCallback(
		(cents: number) => {
			if (hideMoney) return 'R$ ••••'
			return formatCentsBr(cents)
		},
		[hideMoney],
	)

	const value = useMemo(
		() => ({ hideMoney, toggleHideMoney, formatMoney }),
		[hideMoney, toggleHideMoney, formatMoney],
	)

	return (
		<DashboardMoneyVisibilityContext.Provider value={value}>
			{children}
		</DashboardMoneyVisibilityContext.Provider>
	)
}

export function useDashboardMoneyVisibility () {
	const ctx = useContext(DashboardMoneyVisibilityContext)
	if (!ctx) {
		throw new Error(
			'useDashboardMoneyVisibility must be used within DashboardMoneyVisibilityProvider',
		)
	}
	return ctx
}

export function DashboardMoneyText ({
	cents,
	className,
}: {
	cents: number
	className?: string
}) {
	const { formatMoney } = useDashboardMoneyVisibility()
	return <span className={className}>{formatMoney(cents)}</span>
}
