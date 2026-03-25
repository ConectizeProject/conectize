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
	const cpfSearchAbortRef = useRef<AbortController | null>(null)
	const cpfSearchInFlightPrefixRef = useRef<string | null>(null)
	const nameSearchInFlightRef = useRef<string | null>(null)
	const cpfSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	)
	const nameSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	)

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
			cpfSearchAbortRef.current?.abort()
			cpfSearchAbortRef.current = null
			cpfSearchInFlightPrefixRef.current = null
			nameSearchInFlightRef.current = null
			if (cpfSearchDebounceRef.current) {
				clearTimeout(cpfSearchDebounceRef.current)
			}
			if (nameSearchDebounceRef.current) {
				clearTimeout(nameSearchDebounceRef.current)
			}
			cpfSearchDebounceRef.current = null
			nameSearchDebounceRef.current = null
			queueMicrotask(() => {
				setDocumentSearchError(null)
				setCustomersBase([])
				setLastPrefixFetched(null)
				setLastNameQueryFetched(null)
				setIsSearchingDocument(false)
			})
			return
		}

		let cancelled = false

		if (isDocumentMode) {
			if (
				documentPrefix === lastPrefixFetched ||
				cpfSearchInFlightPrefixRef.current === documentPrefix
			) {
				return
			}
			if (cpfSearchDebounceRef.current) {
				clearTimeout(cpfSearchDebounceRef.current)
			}
			cpfSearchDebounceRef.current = setTimeout(() => {
				if (cancelled) return
				cpfSearchAbortRef.current?.abort()
				const controller = new AbortController()
				cpfSearchAbortRef.current = controller
				cpfSearchInFlightPrefixRef.current = documentPrefix
				setIsSearchingDocument(true)
				setDocumentSearchError(null)
				portalFetch(
					`/api/portal/customers/search?documentPrefix=${documentPrefix}`,
					{ signal: controller.signal },
				)
					.then((res) => res.json())
					.then((data) => {
						if (cancelled) return
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
						if (err?.name === 'AbortError') return
						if (!cancelled) {
							setDocumentSearchError('Não foi possível buscar clientes agora.')
							setCustomersBase([])
							setLastPrefixFetched(documentPrefix)
						}
					})
					.finally(() => {
						if (!cancelled) setIsSearchingDocument(false)
						if (cpfSearchInFlightPrefixRef.current === documentPrefix) {
							cpfSearchInFlightPrefixRef.current = null
						}
					})
			}, 350)
		} else if (isNameMode) {
			if (
				nameQuery === lastNameQueryFetched ||
				nameSearchInFlightRef.current === nameQuery
			) {
				return
			}
			if (nameSearchDebounceRef.current) {
				clearTimeout(nameSearchDebounceRef.current)
			}
			nameSearchDebounceRef.current = setTimeout(() => {
				if (cancelled) return
				cpfSearchAbortRef.current?.abort()
				const controller = new AbortController()
				cpfSearchAbortRef.current = controller
				nameSearchInFlightRef.current = nameQuery
				setIsSearchingDocument(true)
				setDocumentSearchError(null)
				portalFetch(
					`/api/portal/customers/search?name=${encodeURIComponent(nameQuery)}`,
					{ signal: controller.signal },
				)
					.then((res) => res.json())
					.then((data) => {
						if (cancelled) return
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
						if (err?.name === 'AbortError') return
						if (!cancelled) {
							setDocumentSearchError('Não foi possível buscar clientes agora.')
							setCustomersBase([])
							setLastNameQueryFetched(nameQuery)
						}
					})
					.finally(() => {
						if (!cancelled) setIsSearchingDocument(false)
						if (nameSearchInFlightRef.current === nameQuery) {
							nameSearchInFlightRef.current = null
						}
					})
			}, 350)
		}

		return () => {
			cancelled = true
			if (cpfSearchDebounceRef.current) {
				clearTimeout(cpfSearchDebounceRef.current)
			}
			if (nameSearchDebounceRef.current) {
				clearTimeout(nameSearchDebounceRef.current)
			}
		}
	}, [
		isDocumentMode,
		isNameMode,
		documentPrefix,
		lastPrefixFetched,
		nameQuery,
		lastNameQueryFetched,
	])

	const hasFetchedDocPrefix =
		isDocumentMode && lastPrefixFetched === documentPrefix
	const hasFetchedName = isNameMode && lastNameQueryFetched === nameQuery
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
