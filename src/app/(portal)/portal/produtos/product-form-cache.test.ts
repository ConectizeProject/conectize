import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	__resetProductFormCacheForTests,
	forgetProductFormCache,
	isProductFormCacheFresh,
	loadProductForm,
	readProductFormCache,
} from './product-form-cache'

function jsonResponse (body: unknown, status = 200) {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: async () => body,
	}
}

describe('product-form-cache', () => {
	beforeEach(() => {
		__resetProductFormCacheForTests()
		vi.stubGlobal('fetch', vi.fn())
	})

	afterEach(() => {
		vi.unstubAllGlobals()
		vi.restoreAllMocks()
		__resetProductFormCacheForTests()
	})

	it('não regrava payload antigo depois de forget durante fetch em voo', async () => {
		let resolveFetch: ((value: unknown) => void) | null = null
		const fetchMock = vi.mocked(fetch)
		fetchMock.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveFetch = resolve
				}) as Promise<Response>,
		)

		const pending = loadProductForm('prod-1')
		forgetProductFormCache('prod-1')

		resolveFetch?.(
			jsonResponse({
				ok: true,
				product: { id: 'prod-1', name: 'Antigo', costPriceCents: 5000 },
				variations: [],
				compatibleModels: [],
			}),
		)

		const result = await pending
		expect(result).toBeNull()
		expect(readProductFormCache('prod-1')).toBeNull()
		expect(isProductFormCacheFresh('prod-1')).toBe(false)
	})

	it('force ignora inflight antigo e carrega payload novo', async () => {
		let resolveOld: ((value: unknown) => void) | null = null
		const fetchMock = vi.mocked(fetch)
		fetchMock
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						resolveOld = resolve
					}) as Promise<Response>,
			)
			.mockResolvedValueOnce(
				jsonResponse({
					ok: true,
					product: { id: 'prod-1', name: 'Novo', costPriceCents: 9000 },
					variations: [],
					compatibleModels: [],
				}) as Response,
			)

		const oldPending = loadProductForm('prod-1')
		const fresh = await loadProductForm('prod-1', { force: true })
		expect(fresh?.product).toMatchObject({ name: 'Novo', costPriceCents: 9000 })
		expect(readProductFormCache('prod-1')?.product).toMatchObject({ name: 'Novo' })

		resolveOld?.(
			jsonResponse({
				ok: true,
				product: { id: 'prod-1', name: 'Antigo', costPriceCents: 5000 },
				variations: [],
				compatibleModels: [],
			}),
		)
		expect(await oldPending).toBeNull()
		expect(readProductFormCache('prod-1')?.product).toMatchObject({ name: 'Novo' })
	})
})
