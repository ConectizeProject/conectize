'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Pencil } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { formatMoneyInput, maskedFromCents, moneyToCentsFromMasked } from '@/lib/utils/money'

type QuickPriceEditorProps = {
	valueCents?: number | null
	align?: 'left' | 'right'
	allowEmpty?: boolean
	emptyLabel?: string
	editAriaLabel: string
	applyingAriaLabel: string
	onCommit: (cents: number | null) => Promise<boolean>
}

export function QuickPriceEditor ({
	valueCents,
	align = 'right',
	allowEmpty = false,
	emptyLabel = '—',
	editAriaLabel,
	applyingAriaLabel,
	onCommit,
}: QuickPriceEditorProps) {
	const justify = align === 'left' ? 'justify-start' : 'justify-end'
	const inputAlign = align === 'left' ? 'text-left' : 'text-right'
	const inputRef = useRef<HTMLInputElement>(null)
	const [isEditing, setIsEditing] = useState(false)
	const [draft, setDraft] = useState('')
	const [isSaving, setIsSaving] = useState(false)
	const [optimisticCents, setOptimisticCents] = useState<number | null | undefined>(undefined)

	const displayCents = optimisticCents !== undefined ? optimisticCents : valueCents

	useEffect(() => {
		if (isSaving || optimisticCents === undefined) return
		const propCents = typeof valueCents === 'number' ? valueCents : null
		if (propCents === optimisticCents) setOptimisticCents(undefined)
	}, [valueCents, optimisticCents, isSaving])

	useEffect(() => {
		if (!isEditing) return
		inputRef.current?.focus()
		inputRef.current?.select()
	}, [isEditing])

	function formatDisplay (cents: number | null | undefined) {
		if (typeof cents === 'number') return formatCurrency(cents / 100)
		return emptyLabel
	}

	function startEdit () {
		setIsEditing(true)
		setDraft(typeof displayCents === 'number' ? maskedFromCents(displayCents) : '')
	}

	function cancelEdit () {
		setIsEditing(false)
		setDraft('')
	}

	async function commit () {
		if (isSaving) return

		const raw = draft.trim()
		let nextCents: number | null
		if (raw === '') {
			if (!allowEmpty) return
			nextCents = null
		} else {
			const parsed = moneyToCentsFromMasked(raw)
			if (parsed === null || parsed < 0) return
			nextCents = parsed
		}

		const current = typeof displayCents === 'number' ? displayCents : null
		if (nextCents === current) {
			cancelEdit()
			return
		}

		setOptimisticCents(nextCents)
		setIsEditing(false)
		setIsSaving(true)

		try {
			const ok = await onCommit(nextCents)
			if (!ok) setOptimisticCents(undefined)
		} catch {
			setOptimisticCents(undefined)
		} finally {
			setIsSaving(false)
			setDraft('')
		}
	}

	if (isSaving) {
		return (
			<div
				className={`flex items-center gap-1.5 ${justify}`}
				onClick={(event) => event.stopPropagation()}
			>
				<span className="tabular-nums">{formatDisplay(displayCents)}</span>
				<Loader2
					className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground"
					aria-label={applyingAriaLabel}
				/>
			</div>
		)
	}

	if (isEditing) {
		return (
			<div
				className={`flex items-center gap-1 ${justify}`}
				onClick={(event) => event.stopPropagation()}
			>
				<input
					ref={inputRef}
					type="text"
					inputMode="numeric"
					autoComplete="off"
					placeholder="0,00"
					aria-label={editAriaLabel}
					className={`h-8 min-w-[6.5rem] max-w-[7.5rem] rounded border border-input bg-card px-2 text-xs tabular-nums ${inputAlign}`}
					value={draft}
					onChange={(event) => setDraft(formatMoneyInput(event.target.value))}
					onBlur={() => {
						void commit()
					}}
					onKeyDown={(event) => {
						if (event.key === 'Enter') {
							event.preventDefault()
							void commit()
						}
						if (event.key === 'Escape') {
							event.preventDefault()
							cancelEdit()
						}
					}}
				/>
			</div>
		)
	}

	return (
		<div
			className={`flex items-center gap-1 ${justify}`}
			onClick={(event) => event.stopPropagation()}
		>
			<span className="tabular-nums">{formatDisplay(displayCents)}</span>
			<button
				type="button"
				className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted"
				onClick={startEdit}
				aria-label={editAriaLabel}
				title={editAriaLabel}
			>
				<Pencil className="h-3 w-3" />
			</button>
		</div>
	)
}
