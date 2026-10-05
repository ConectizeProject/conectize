export const BLING_CATALOG_SYNC_ACTIONS = ['start', 'step', 'census', 'details', 'retry'] as const

export type BlingCatalogSyncAction = (typeof BLING_CATALOG_SYNC_ACTIONS)[number]

export type BlingCatalogSyncStatus =
	| 'idle'
	| 'listing'
	| 'detailing'
	| 'paused'
	| 'completed'
	| 'error'

export type BlingCatalogSyncView = {
	ok: boolean
	runId: string | null
	status: BlingCatalogSyncStatus
	totalListed: number
	created: number
	updated: number
	detailed: number
	failed: number
	pendingDetail: number
	skippedDetail: number
	imported: number
	lastPage: number
	censusDone: boolean
	truncated: boolean
	advanced: boolean
	errorMessage: string | null
	message: string | null
}

export function emptyBlingCatalogSyncView (): BlingCatalogSyncView {
	return {
		ok: true,
		runId: null,
		status: 'idle',
		totalListed: 0,
		created: 0,
		updated: 0,
		detailed: 0,
		failed: 0,
		pendingDetail: 0,
		skippedDetail: 0,
		imported: 0,
		lastPage: 0,
		censusDone: false,
		truncated: false,
		advanced: false,
		errorMessage: null,
		message: null,
	}
}
