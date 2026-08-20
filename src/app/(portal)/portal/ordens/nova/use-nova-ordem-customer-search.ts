'use client'

import type { CustomerHit } from '@/components/customers'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
import { onlyDigits } from '@/lib/utils/strings'
import { useEffect, useMemo, useRef, useState } from 'react'

function getCustomerDocumentDigits (customer: CustomerHit) {
	return onlyDigits(String(customer.cnpj || customer.cpf || '')).slice(0, 14)
}

type Params = {
	selectedCustomer: CustomerHit | null
}

export function useNovaOrdemCustomerSearch ({ selectedCustomer }: Params) {
	const [customerSearchInput, setCustomerSearchInput] = useState('')
	const documentDigits = useMemo(
		() => onlyDigits(customerSearchInput).slice(0, 14),
		[customerSearchInput],
	)
	const documentPrefix = useMemo(
		() => documentDigits.slice(0, 5),
		[documentDigits],
	)
	const nameQuery = useMemo(
		() => customerSearchInput.trim(),
		[customerSearchInput],
	)
	const isDocumentMode = documentDigits.length >= 5
	const isNameMode =
		nameQuery.length >= 2 && /[a-zA-Z\u00C0-\u024F]/.test(nameQuery)

	const [customersBase, setCustomersBase] = useState<CustomerHit[]>([])
	const [isSearchingDocument, setIsSearchingDocument] = useState(false)
	const [documentSearchError, setDocumentSearchError] = useState<string | null>(
		null,
	)
	const [lastPrefixFetched, setLastPrefixFetched] = useState<string | null>(
		null,
	)
	const [lastNameQueryFetched, setLastNameQueryFetched] = useState<
		string | null
	>(null)
	const searchAbortRef = useRef<AbortController | null>(null)
	const documentDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const nameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const [isCpfPopoverOpen, setIsCpfPopoverOpen] = useState(false)

	useEffect(() => {
		if (!selectedCustomer) return
		const doc = getCustomerDocumentDigits(selectedCustomer)
		if (doc && doc !== documentDigits) {
			queueMicrotask(() => {
				setCustomerSearchInput(formatCpfCnpj(doc))
			})
		}
	}, [documentDigits, selectedCustomer])

	useEffect(() => {
		if (!isDocumentMode && !isNameMode) {
			searchAbortRef.current?.abort()
			searchAbortRef.current = null
			if (documentDebounceRef.current) clearTimeout(documentDebounceRef.current)
			if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current)
			documentDebounceRef.current = null
			nameDebounceRef.current = null
			queueMicrotask(() => {
				setDocumentSearchError(null)
				setCustomersBase([])
				setLastPrefixFetched(null)
				setLastNameQueryFetched(null)
				setIsSearchingDocument(false)
			})
		}
	}, [isDocumentMode, isNameMode])

	useEffect(() => {
		if (!isDocumentMode) return
		if (documentPrefix === lastPrefixFetched) {
			setIsSearchingDocument(false)
			return
		}

		if (documentDebounceRef.current) clearTimeout(documentDebounceRef.current)

		documentDebounceRef.current = setTimeout(() => {
			searchAbortRef.current?.abort()
			const controller = new AbortController()
			searchAbortRef.current = controller
			setIsSearchingDocument(true)
			setDocumentSearchError(null)

			portalFetch(
				`/api/portal/customers/search?documentPrefix=${documentPrefix}`,
				{ signal: controller.signal },
			)
				.then((res) => res.json())
				.then((data) => {
					if (controller.signal.aborted) return
					if (!data?.ok) {
						setDocumentSearchError('Não foi possível buscar clientes agora.')
						setCustomersBase([])
						setLastPrefixFetched(documentPrefix)
						return
					}
					setCustomersBase(data.customers || [])
					setLastPrefixFetched(documentPrefix)
				})
				.catch((err: { name?: string }) => {
					if (err?.name === 'AbortError' || controller.signal.aborted) return
					setDocumentSearchError('Não foi possível buscar clientes agora.')
					setCustomersBase([])
					setLastPrefixFetched(documentPrefix)
				})
				.finally(() => {
					if (searchAbortRef.current === controller) {
						searchAbortRef.current = null
					}
					if (!controller.signal.aborted) {
						setIsSearchingDocument(false)
					}
				})
		}, 350)

		return () => {
			if (documentDebounceRef.current) {
				clearTimeout(documentDebounceRef.current)
				documentDebounceRef.current = null
			}
			searchAbortRef.current?.abort()
		}
	}, [isDocumentMode, documentPrefix, lastPrefixFetched])

	useEffect(() => {
		if (!isNameMode || isDocumentMode) return
		if (nameQuery === lastNameQueryFetched) {
			setIsSearchingDocument(false)
			return
		}

		if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current)

		nameDebounceRef.current = setTimeout(() => {
			searchAbortRef.current?.abort()
			const controller = new AbortController()
			searchAbortRef.current = controller
			setIsSearchingDocument(true)
			setDocumentSearchError(null)

			portalFetch(
				`/api/portal/customers/search?name=${encodeURIComponent(nameQuery)}`,
				{ signal: controller.signal },
			)
				.then((res) => res.json())
				.then((data) => {
					if (controller.signal.aborted) return
					if (!data?.ok) {
						setDocumentSearchError('Não foi possível buscar clientes agora.')
						setCustomersBase([])
						setLastNameQueryFetched(nameQuery)
						return
					}
					setCustomersBase(data.customers || [])
					setLastNameQueryFetched(nameQuery)
				})
				.catch((err: { name?: string }) => {
					if (err?.name === 'AbortError' || controller.signal.aborted) return
					setDocumentSearchError('Não foi possível buscar clientes agora.')
					setCustomersBase([])
					setLastNameQueryFetched(nameQuery)
				})
				.finally(() => {
					if (searchAbortRef.current === controller) {
						searchAbortRef.current = null
					}
					if (!controller.signal.aborted) {
						setIsSearchingDocument(false)
					}
				})
		}, 350)

		return () => {
			if (nameDebounceRef.current) {
				clearTimeout(nameDebounceRef.current)
				nameDebounceRef.current = null
			}
			searchAbortRef.current?.abort()
		}
	}, [isDocumentMode, isNameMode, nameQuery, lastNameQueryFetched])

	const hasFetchedDocPrefix =
		isDocumentMode && lastPrefixFetched === documentPrefix
	const hasFetchedName =
		isNameMode && !isDocumentMode && lastNameQueryFetched === nameQuery
	const hasFetched = hasFetchedDocPrefix || hasFetchedName

	const customersFiltered = useMemo(() => {
		if (!hasFetched) return []
		if (isDocumentMode) {
			return customersBase.filter((c) =>
				getCustomerDocumentDigits(c).startsWith(documentDigits),
			)
		}
		return customersBase
	}, [customersBase, hasFetched, isDocumentMode, documentDigits])

	return {
		customerSearchInput,
		setCustomerSearchInput,
		documentDigits,
		documentPrefix,
		nameQuery,
		isDocumentMode,
		isNameMode,
		customersBase,
		setCustomersBase,
		isSearchingDocument,
		documentSearchError,
		hasFetched,
		customersFiltered,
		isCpfPopoverOpen,
		setIsCpfPopoverOpen,
		setLastPrefixFetched,
	}
}

export { getCustomerDocumentDigits }
