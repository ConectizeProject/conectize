import { describe, expect, it } from 'vitest'
import { blingRetryDelayMs, isBlingTooManyRequests } from '@/lib/integrations/bling/bling-rate-limit'
import { blingCatalogSyncErrorMessage, hasStoredBlingDetail } from '@/lib/integrations/bling/catalog-sync-rules'

describe('bling rate limit', () => {
	it('reconhece HTTP 429 e a mensagem do Bling', () => {
		expect(isBlingTooManyRequests(429, '')).toBe(true)
		expect(isBlingTooManyRequests(200, 'TOO_MANY_REQUESTS')).toBe(true)
		expect(isBlingTooManyRequests(500, 'db_error')).toBe(false)
	})

	it('respeita Retry-After e limita o backoff', () => {
		expect(blingRetryDelayMs('2', 1)).toBe(2000)
		expect(blingRetryDelayMs('90', 1)).toBe(15000)
		expect(blingRetryDelayMs(null, 3)).toBe(3000)
	})
})

describe('catalog sync rules', () => {
	it('pula detalhe só quando GTIN e NCM já existem', () => {
		expect(hasStoredBlingDetail({ barcode: '789', ncm: '85171231' })).toBe(true)
		expect(hasStoredBlingDetail({ barcode: '789', ncm: null })).toBe(false)
		expect(hasStoredBlingDetail({ barcode: '  ', ncm: '85171231' })).toBe(false)
	})

	it('explica o limite sem falar em renovação de token', () => {
		const message = blingCatalogSyncErrorMessage('bling_too_many_requests')
		expect(message.toLowerCase()).toContain('limitou')
		expect(message.toLowerCase()).not.toContain('token')
	})
})
