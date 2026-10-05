import { blingRefreshTokenErrorToMessage } from '@/lib/integrations/bling/refresh-token-errors'
import { BLING_TOO_MANY_REQUESTS, isBlingTooManyRequests } from '@/lib/integrations/bling/bling-rate-limit'

/** GTIN e NCM já gravados: a listagem não precisa buscar o GET individual. */
export function hasStoredBlingDetail (row: {
	barcode?: string | null
	ncm?: string | null
}) {
	return Boolean(String(row.barcode || '').trim() && String(row.ncm || '').trim())
}

export function blingCatalogSyncErrorMessage (error: string | null | undefined): string {
	const raw = String(error || '').trim()
	if (!raw) return 'Não foi possível sincronizar o catálogo.'
	if (raw === BLING_TOO_MANY_REQUESTS || isBlingTooManyRequests(0, raw)) {
		return 'O Bling limitou as requisições. O que já foi importado está salvo. Use Continuar daqui a pouco.'
	}
	if (/invalid_token|invalid_grant|no_refresh_token|bling_access_token_missing/i.test(raw)) {
		return blingRefreshTokenErrorToMessage(raw)
	}
	if (raw === 'db_error') return 'Falha ao gravar o catálogo. Tente continuar.'
	return raw
}
