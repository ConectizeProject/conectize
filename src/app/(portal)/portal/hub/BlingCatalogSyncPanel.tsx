'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import {
	emptyBlingCatalogSyncView,
	type BlingCatalogSyncView,
} from '@/lib/integrations/bling/catalog-sync-types'
import {
	fetchBlingCatalogSyncStatus,
	runBlingCatalogSync,
} from '@/lib/integrations/bling/catalog-sync-client'
import { appConfirm } from '@/lib/ui/app-dialogs'

const STATUS_LABEL: Record<BlingCatalogSyncView['status'], string> = {
	idle: 'Nenhuma importação em andamento',
	listing: 'Lendo a lista de produtos no Bling',
	detailing: 'Completando GTIN e dados fiscais',
	paused: 'Pausado: o Bling limitou as requisições',
	completed: 'Importação concluída',
	error: 'Importação interrompida',
}

function formatProgress (view: BlingCatalogSyncView) {
	if (view.status === 'idle' && view.imported === 0 && view.totalListed === 0) return null
	const parts = [
		`${view.totalListed} listado(s) no Bling`,
		`${view.imported} no catálogo`,
		`${view.created} criado(s)`,
		`${view.updated} atualizado(s)`,
		`${view.pendingDetail} sem detalhe`,
	]
	if (view.failed > 0) parts.push(`${view.failed} com falha`)
	return parts.join(' · ')
}

export function BlingCatalogSyncPanel ({ onFinished }: { onFinished?: () => void }) {
	const [view, setView] = useState<BlingCatalogSyncView>(emptyBlingCatalogSyncView)
	const [loading, setLoading] = useState(true)
	const [syncing, setSyncing] = useState(false)

	useEffect(() => {
		let cancelled = false
		void fetchBlingCatalogSyncStatus().then((next) => {
			if (cancelled) return
			setView(next)
			setLoading(false)
		})
		return () => {
			cancelled = true
		}
	}, [])

	const run = useCallback(async (phase: 'full' | 'details' | 'retry', confirmStart: boolean) => {
		if (syncing) return
		if (confirmStart) {
			const confirmed = await appConfirm({
				title: 'Sincronizar catálogo do Bling?',
				description: 'Grava a lista de produtos e depois completa GTIN e dados fiscais em lotes. Se o Bling limitar as requisições, o progresso fica salvo para continuar.',
				confirmLabel: 'Sincronizar',
			})
			if (!confirmed) return
		}

		setSyncing(true)
		try {
			const result = await runBlingCatalogSync({
				phase,
				onProgress: setView,
			})
			setView(result)
			if (!result.ok || result.status === 'error') {
				toast({
					title: 'Falha ao sincronizar catálogo',
					description: result.message || 'Tente continuar daqui a pouco.',
					variant: 'destructive',
				})
				return
			}
			if (result.status === 'paused') {
				toast({
					title: 'Importação pausada',
					description: result.message || 'O Bling limitou as requisições. Use Continuar daqui a pouco.',
				})
				return
			}
			if (result.status === 'completed' || (phase === 'details' && result.pendingDetail === 0)) {
				toast({
					variant: 'success',
					title: 'Catálogo sincronizado',
					description: formatProgress(result) || 'Nenhum produto novo.',
				})
				onFinished?.()
			}
		} finally {
			setSyncing(false)
		}
	}, [onFinished, syncing])

	const canResume = view.status === 'listing'
		|| view.status === 'detailing'
		|| view.status === 'paused'
		|| view.status === 'error'
	const covered = Math.max(0, view.imported - view.pendingDetail - view.failed)
	const progressMax = Math.max(view.imported, 1)
	const showProgress = view.imported > 0 || view.totalListed > 0
	const summary = formatProgress(view)

	return (
		<div className="rounded-md border p-3 space-y-2">
			<p className="text-sm font-medium">Sincronizar catálogo</p>
			<p className="text-xs text-muted-foreground">
				Lê a lista do Bling e grava o catálogo. GTIN e dados fiscais entram em lotes, com opção de continuar ou tentar de novo o que falhou.
			</p>
			{loading ? (
				<p className="text-xs text-muted-foreground">Carregando progresso…</p>
			) : (
				<div className="space-y-1.5">
					<p className="text-xs text-foreground">
						{syncing && view.status === 'idle' ? 'Importando…' : STATUS_LABEL[view.status]}
					</p>
					{summary ? <p className="text-xs text-muted-foreground">{summary}</p> : null}
					{view.message && view.status !== 'completed' ? (
						<p className="text-xs text-muted-foreground">{view.message}</p>
					) : null}
					{view.truncated ? (
						<p className="text-xs text-muted-foreground">
							A listagem parou em 10.000 produtos. Sincronize de novo para atualizar os que já entraram.
						</p>
					) : null}
					{showProgress ? (
						<progress
							className="h-2 w-full"
							value={covered}
							max={progressMax}
							aria-label="Progresso da importação do catálogo Bling"
						/>
					) : null}
				</div>
			)}
			<div className="flex flex-wrap gap-2">
				<Button
					type="button"
					size="sm"
					disabled={syncing || loading}
					onClick={() => void run('full', !canResume)}
					className="gap-1.5"
				>
					{syncing
						? <Loader2 className="h-3.5 w-3.5 animate-spin" />
						: <RefreshCw className="h-3.5 w-3.5" />}
					{syncing ? 'Sincronizando…' : canResume ? 'Continuar' : 'Sincronizar catálogo'}
				</Button>
				{view.pendingDetail > 0 && view.status !== 'listing' && view.status !== 'detailing' ? (
					<Button
						type="button"
						size="sm"
						variant="outline"
						disabled={syncing || loading}
						onClick={() => void run('details', false)}
					>
						Completar detalhes
					</Button>
				) : null}
				{view.failed > 0 ? (
					<Button
						type="button"
						size="sm"
						variant="outline"
						disabled={syncing || loading}
						onClick={() => void run('retry', false)}
					>
						Tentar itens com falha
					</Button>
				) : null}
				<Button type="button" size="sm" variant="outline" asChild>
					<Link href="/portal/produtos" prefetch={false}>
						Ver produtos
					</Link>
				</Button>
			</div>
		</div>
	)
}
