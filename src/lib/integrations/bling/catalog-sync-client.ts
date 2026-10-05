import {
	emptyBlingCatalogSyncView,
	type BlingCatalogSyncAction,
	type BlingCatalogSyncStatus,
	type BlingCatalogSyncView,
} from '@/lib/integrations/bling/catalog-sync-types'

const STATUSES: BlingCatalogSyncStatus[] = ['idle', 'listing', 'detailing', 'paused', 'completed', 'error']

function int (value: unknown) {
	const n = Number(value)
	return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0
}

export function parseBlingCatalogSyncView (payload: unknown, httpOk: boolean): BlingCatalogSyncView {
	const base = emptyBlingCatalogSyncView()
	if (!payload || typeof payload !== 'object') {
		return {
			...base,
			ok: false,
			status: 'error',
			message: 'Resposta inválida ao sincronizar o catálogo.',
		}
	}
	const record = payload as Record<string, unknown>
	const statusRaw = String(record.status || 'idle')
	const status = STATUSES.includes(statusRaw as BlingCatalogSyncStatus)
		? statusRaw as BlingCatalogSyncStatus
		: 'error'
	return {
		ok: httpOk && record.ok !== false,
		runId: record.runId != null ? String(record.runId) : null,
		status,
		totalListed: int(record.totalListed),
		created: int(record.created),
		updated: int(record.updated),
		detailed: int(record.detailed),
		failed: int(record.failed),
		pendingDetail: int(record.pendingDetail),
		skippedDetail: int(record.skippedDetail),
		imported: int(record.imported),
		lastPage: int(record.lastPage),
		censusDone: record.censusDone === true,
		truncated: record.truncated === true,
		advanced: record.advanced === true,
		errorMessage: record.errorMessage != null ? String(record.errorMessage) : null,
		message: record.message != null ? String(record.message) : null,
	}
}

async function postAction (action: BlingCatalogSyncAction) {
	const res = await fetch('/api/portal/bling/sync-catalog', {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ action }),
	})
	const data = await res.json().catch(() => null)
	return parseBlingCatalogSyncView(data, res.ok)
}

export async function fetchBlingCatalogSyncStatus () {
	const res = await fetch('/api/portal/bling/sync-catalog', {
		method: 'GET',
		credentials: 'include',
	})
	const data = await res.json().catch(() => null)
	return parseBlingCatalogSyncView(data, res.ok)
}

function shouldContinue (
	view: BlingCatalogSyncView,
	phase: 'full' | 'census' | 'details' | 'retry',
) {
	if (!view.ok || !view.advanced) return false
	if (view.status === 'paused' || view.status === 'error') return false
	if (phase === 'census') return !view.censusDone
	if (phase === 'retry') return view.failed > 0
	if (phase === 'details') return view.pendingDetail > 0
	return view.status === 'listing' || view.status === 'detailing'
}

export async function runBlingCatalogSync (options: {
	phase: 'full' | 'census' | 'details' | 'retry'
	onProgress?: (view: BlingCatalogSyncView) => void
	signal?: AbortSignal
}) {
	let action: BlingCatalogSyncAction = options.phase === 'retry'
		? 'retry'
		: options.phase === 'details'
			? 'details'
			: options.phase === 'census'
				? 'census'
				: 'start'
	let view = emptyBlingCatalogSyncView()
	let guard = 0
	while (guard < 500) {
		if (options.signal?.aborted) return view
		guard += 1
		view = await postAction(action)
		options.onProgress?.(view)
		if (!shouldContinue(view, options.phase)) return view
		if (options.phase === 'full') action = 'step'
	}
	return view
}
