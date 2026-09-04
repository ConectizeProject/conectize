'use client'

import { Loader2, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import type { MeliListingGroup } from '@/lib/integrations/mercado-livre/listing-variations'
import { meliSyncFailureMessage } from '@/lib/integrations/mercado-livre/refresh-token-errors'
import { cn } from '@/lib/utils'
import { MeliListingGroupCard } from './MeliListingGroupCard'

type Props = {
	isConnected: boolean
	isAdmin: boolean
	initialQ: string
	initialStatus: string
	initialPage: number
}

const STATUS_OPTIONS = [
	{ value: 'all', label: 'Todos' },
	{ value: 'active', label: 'Ativos' },
	{ value: 'paused', label: 'Pausados' },
	{ value: 'closed', label: 'Encerrados' },
	{ value: 'under_review', label: 'Em revisão' },
] as const

export function MeliAnunciosClient({
	isConnected,
	isAdmin,
	initialQ,
	initialStatus,
	initialPage,
}: Props) {
	const router = useRouter()
	const pathname = usePathname()
	const [q, setQ] = useState(initialQ)
	const [status, setStatus] = useState(initialStatus || 'all')
	const [page, setPage] = useState(initialPage)
	const [groups, setGroups] = useState<MeliListingGroup[]>([])
	const [total, setTotal] = useState(0)
	const [loading, setLoading] = useState(true)
	const [syncing, setSyncing] = useState(false)
	const pageSize = 24

	const pushFilters = useCallback(
		(next: { q?: string; status?: string; page?: number }) => {
			const params = new URLSearchParams()
			const nextQ = next.q ?? q
			const nextStatus = next.status ?? status
			const nextPage = next.page ?? page
			if (nextQ.trim()) params.set('q', nextQ.trim())
			if (nextStatus && nextStatus !== 'all') params.set('status', nextStatus)
			if (nextPage > 1) params.set('page', String(nextPage))
			const qs = params.toString()
			router.replace(qs ? `${pathname}?${qs}` : pathname)
		},
		[page, pathname, q, router, status],
	)

	const loadListings = useCallback(async () => {
		setLoading(true)
		try {
			const params = new URLSearchParams()
			params.set('page', String(page))
			params.set('pageSize', String(pageSize))
			if (q.trim()) params.set('q', q.trim())
			if (status && status !== 'all') params.set('status', status)

			const res = await fetch(`/api/portal/mercado-livre/listings?${params}`, {
				credentials: 'include',
			})
			const data = await res.json().catch(() => null)
			if (!res.ok || !data?.ok) {
				toast({
					title: 'Falha ao carregar anúncios',
					description: String(
						data?.message || data?.error || 'Tente novamente.',
					),
					variant: 'destructive',
				})
				setGroups([])
				setTotal(0)
				return
			}
			setGroups((data.groups || []) as MeliListingGroup[])
			setTotal(Number(data.total) || 0)
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Falha de rede.'
			toast({
				title: 'Falha ao carregar anúncios',
				description: message,
				variant: 'destructive',
			})
		} finally {
			setLoading(false)
		}
	}, [page, pageSize, q, status])

	useEffect(() => {
		void loadListings()
	}, [loadListings])

	async function handleSync() {
		if (!isAdmin || syncing) return
		setSyncing(true)
		try {
			const res = await fetch('/api/portal/mercado-livre/sync-listings', {
				method: 'POST',
				credentials: 'include',
			})
			const data = await res.json().catch(() => null)
			if (!res.ok || !data?.ok) {
				toast({
					title: 'Falha ao sincronizar',
					description: meliSyncFailureMessage(data),
					variant: 'destructive',
				})
				return
			}

			const created = Number(data.productsCreated || 0)
			const linked = Number(data.productsLinked || 0)
			const upserted = Number(data.upserted || 0)
			toast({
				variant: 'success',
				title: 'Anúncios sincronizados',
				description: `${upserted} anúncio(s) · ${created} produto(s) criado(s) · ${linked} vinculado(s)`,
			})
			setPage(1)
			pushFilters({ page: 1 })
			router.refresh()
			await loadListings()
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Falha de rede.'
			toast({
				title: 'Falha ao sincronizar',
				description: message,
				variant: 'destructive',
			})
		} finally {
			setSyncing(false)
		}
	}

	const totalPages = Math.max(1, Math.ceil(total / pageSize))
	const hasPrev = page > 1
	const hasNext = page < totalPages

	if (!isConnected) {
		return (
			<Card>
				<CardContent className="flex flex-col items-start gap-3 p-6">
					<p className="text-sm text-muted-foreground">
						Conecte a conta do Mercado Livre no HUB para sincronizar e exibir os
						anúncios.
					</p>
					<Button asChild>
						<Link href="/portal/hub">Abrir HUB</Link>
					</Button>
				</CardContent>
			</Card>
		)
	}

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
				<form
					className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end"
					onSubmit={(e) => {
						e.preventDefault()
						setPage(1)
						pushFilters({ page: 1, q, status })
					}}
				>
					<div className="min-w-0 flex-1 space-y-1.5">
						<label
							htmlFor="meli-q"
							className="text-xs font-medium text-muted-foreground"
						>
							Buscar
						</label>
						<Input
							id="meli-q"
							value={q}
							onChange={(e) => setQ(e.target.value)}
							placeholder="Título, SKU ou ID do anúncio"
						/>
					</div>
					<div className="w-full space-y-1.5 sm:w-44">
						<label
							htmlFor="meli-status"
							className="text-xs font-medium text-muted-foreground"
						>
							Status
						</label>
						<select
							id="meli-status"
							value={status}
							onChange={(e) => {
								const next = e.target.value
								setStatus(next)
								setPage(1)
								pushFilters({ status: next, page: 1 })
							}}
							className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
						>
							{STATUS_OPTIONS.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.label}
								</option>
							))}
						</select>
					</div>
					<Button type="submit" variant="outline">
						Filtrar
					</Button>
				</form>

				{isAdmin ? (
					<Button
						type="button"
						onClick={() => void handleSync()}
						disabled={syncing}
						className="shrink-0 gap-1.5"
					>
						{syncing ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<RefreshCw className="h-4 w-4" />
						)}
						{syncing ? 'Sincronizando…' : 'Sincronizar anúncios'}
					</Button>
				) : null}
			</div>

			{loading ? (
				<div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
					<Loader2 className="h-4 w-4 animate-spin" />
					Carregando anúncios…
				</div>
			) : groups.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-start gap-3 p-6">
						<p className="text-sm text-muted-foreground">
							Nenhum anúncio no cache.{' '}
							{isAdmin
								? 'Clique em Sincronizar anúncios para importar da conta ML.'
								: 'Peça a um administrador para sincronizar no HUB.'}
						</p>
					</CardContent>
				</Card>
			) : (
				<>
					<p className="text-xs text-muted-foreground">
						{total} anúncio(s) · página {page} de {totalPages}
					</p>
					<ul className="space-y-3">
						{groups.map((group) => (
							<li key={group.key}>
								<MeliListingGroupCard group={group} query={q} />
							</li>
						))}
					</ul>

					{hasPrev || hasNext ? (
						<div className="flex items-center justify-between gap-2">
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={!hasPrev}
								onClick={() => {
									const next = page - 1
									setPage(next)
									pushFilters({ page: next })
								}}
							>
								Anterior
							</Button>
							<span className={cn('text-xs text-muted-foreground')}>
								Página {page}
							</span>
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={!hasNext}
								onClick={() => {
									const next = page + 1
									setPage(next)
									pushFilters({ page: next })
								}}
							>
								Próxima
							</Button>
						</div>
					) : null}
				</>
			)}
		</div>
	)
}
