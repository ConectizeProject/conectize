'use client'

import { Plus, Trash2 } from 'lucide-react'
import { MoneyInput } from '@/components/forms'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { fiscalPaymentTypeOptions } from '@/lib/fiscal/payment-type-options'
import { syncAmountRowsToTotal } from '@/lib/fiscal/sync-payment-amounts'
import { formatMoneyInput, maskedFromCents, moneyToCentsFromMasked } from '@/lib/utils/money'

export type FiscalPaymentDraft = {
  key: string
  type: string
  value: string
}

function newPaymentKey () {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `pay-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function emptyFiscalPaymentDraft (): FiscalPaymentDraft {
  return { key: newPaymentKey(), type: '', value: '' }
}

export function fiscalPaymentDraftsFromRows (
  rows: Array<{ type: string, value_cents: number }>,
): FiscalPaymentDraft[] {
  if (rows.length === 0) return [emptyFiscalPaymentDraft()]
  return rows.map((row) => ({
    key: newPaymentKey(),
    type: row.type,
    value: row.type === '90' ? '0,00' : maskedFromCents(row.value_cents),
  }))
}

export function syncFiscalPaymentDrafts (
  drafts: FiscalPaymentDraft[],
  totalCents: number,
): FiscalPaymentDraft[] {
  if (drafts.length === 0) return drafts
  const cents = syncAmountRowsToTotal(
    drafts.map((draft) => ({
      type: draft.type,
      valueCents: draft.type === '90' ? 0 : (moneyToCentsFromMasked(draft.value) ?? 0),
    })),
    totalCents,
  )
  return drafts.map((draft, index) => ({
    ...draft,
    value: draft.type === '90' ? '0,00' : maskedFromCents(cents[index] ?? 0),
  }))
}

export function fiscalPaymentDraftCents (drafts: FiscalPaymentDraft[]) {
  return drafts.reduce((sum, draft) => {
    if (!draft.type || draft.type === '90') return sum
    return sum + (moneyToCentsFromMasked(draft.value) ?? 0)
  }, 0)
}

type Props = {
  payments: FiscalPaymentDraft[]
  totalCents: number
  disabled?: boolean
  onChange: (payments: FiscalPaymentDraft[]) => void
  onCommit?: (payments: FiscalPaymentDraft[]) => void
}

export function FiscalPaymentsEditor ({
  payments,
  totalCents,
  disabled = false,
  onChange,
  onCommit,
}: Props) {
  const rows = payments
  const shownCents = rows.reduce((sum, draft) => {
    if (draft.type === '90') return sum
    return sum + (moneyToCentsFromMasked(draft.value) ?? 0)
  }, 0)
  const hasPayable = rows.some((payment) => payment.type && payment.type !== '90')
  const mismatch = hasPayable && fiscalPaymentDraftCents(rows) !== totalCents

  function commit (next: FiscalPaymentDraft[]) {
    onChange(next)
    onCommit?.(next)
  }

  function updateRow (key: string, patch: Partial<FiscalPaymentDraft>, shouldCommit: boolean) {
    const next = rows.map((payment) => {
      if (payment.key !== key) return payment
      const type = patch.type ?? payment.type
      const value = type === '90'
        ? '0,00'
        : (patch.value ?? payment.value)
      return { ...payment, ...patch, type, value }
    })
    if (shouldCommit) commit(next)
    else onChange(next)
  }

  return (
    <div className='space-y-3 sm:col-span-2'>
      {rows.map((payment, index) => (
        <div key={payment.key} className='grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem_auto] sm:items-end'>
          <div className='space-y-1.5'>
            <Label htmlFor={`fiscal-payment-type-${payment.key}`}>
              {rows.length > 1 ? `Forma de pagamento ${index + 1}` : 'Forma de pagamento'}
            </Label>
            <Select
              value={payment.type}
              disabled={disabled}
              onValueChange={(type) => updateRow(payment.key, { type }, true)}
            >
              <SelectTrigger id={`fiscal-payment-type-${payment.key}`} className='bg-transparent'>
                <SelectValue placeholder='Selecione' />
              </SelectTrigger>
              <SelectContent>
                {fiscalPaymentTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor={`fiscal-payment-value-${payment.key}`}>Valor pago</Label>
            <MoneyInput
              id={`fiscal-payment-value-${payment.key}`}
              value={payment.type === '90' ? '0,00' : payment.value}
              disabled={disabled || !payment.type || payment.type === '90'}
              onChange={(value) => updateRow(payment.key, { value }, false)}
              onBlur={(event) => updateRow(payment.key, { value: formatMoneyInput(event.target.value) }, true)}
            />
          </div>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='text-muted-foreground'
            disabled={disabled || rows.length === 1}
            aria-label={`Remover forma de pagamento ${index + 1}`}
            onClick={() => {
              const next = rows.filter((row) => row.key !== payment.key)
              commit(next.length > 0 ? next : [emptyFiscalPaymentDraft()])
            }}
          >
            <Trash2 className='h-4 w-4' />
          </Button>
        </div>
      ))}
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <Button
          type='button'
          variant='outline'
          size='sm'
          disabled={disabled || rows.some((payment) => payment.type === '90')}
          onClick={() => {
            const remainder = Math.max(0, totalCents - shownCents)
            onChange([...rows, {
              key: newPaymentKey(),
              type: '',
              value: maskedFromCents(remainder),
            }])
          }}
        >
          <Plus className='mr-1 h-4 w-4' />
          Incluir forma de pagamento
        </Button>
        <p className={`text-xs ${mismatch ? 'text-destructive' : 'text-muted-foreground'}`}>
          Soma dos pagamentos: R$ {maskedFromCents(shownCents)}. Total da nota: R$ {maskedFromCents(totalCents)}.
        </p>
      </div>
    </div>
  )
}
