'use client'

import { Minus, Plus } from 'lucide-react'
import { formatMoneyInput } from '@/lib/utils/money'

export const inputGroupShell = 'flex h-9 w-full overflow-hidden rounded-md border border-input bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2'
export const insertFormFieldClass = 'min-w-0 md:flex-[1_1_5rem]'
export const pdvColumnHeaderClass = 'flex h-10 shrink-0 items-center border-b px-4'
export const pdvColumnTitleClass = 'text-sm font-medium leading-none'

export function QuantityStepper ({
  value,
  onChange,
  disabled,
  inputId,
}: {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  inputId?: string
}) {
  function handleInputChange (raw: string) {
    const digits = raw.replace(/\D/g, '')
    if (!digits) {
      onChange(1)
      return
    }
    onChange(Math.max(1, Number.parseInt(digits, 10) || 1))
  }

  return (
    <div className={inputGroupShell} role='group' aria-label='Quantidade'>
      <button
        type='button'
        disabled={disabled || value <= 1}
        className='flex w-6 shrink-0 items-center justify-center border-r border-input text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50'
        onClick={() => onChange(Math.max(1, value - 1))}
      >
        <Minus className='h-3.5 w-3.5' />
      </button>
      <input
        id={inputId}
        type='text'
        inputMode='numeric'
        disabled={disabled}
        value={String(value)}
        onChange={(e) => handleInputChange(e.target.value)}
        className='min-w-0 flex-1 border-0 bg-transparent px-1 text-center text-xs outline-none disabled:cursor-not-allowed disabled:opacity-50'
      />
      <button
        type='button'
        disabled={disabled}
        className='flex w-6 shrink-0 items-center justify-center border-l border-input text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50'
        onClick={() => onChange(value + 1)}
      >
        <Plus className='h-3.5 w-3.5' />
      </button>
    </div>
  )
}

export function DiscountField ({
  value,
  onChange,
  mode,
  onModeToggle,
  disabled,
  ariaLabel = 'Desconto',
}: {
  value: string
  onChange: (value: string) => void
  mode: 'fixed' | 'percent'
  onModeToggle: () => void
  disabled?: boolean
  ariaLabel?: string
}) {
  return (
    <div className={inputGroupShell} role='group' aria-label={ariaLabel}>
      <input
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(
          mode === 'percent'
            ? e.target.value.replace(/[^\d,]/g, '')
            : formatMoneyInput(e.target.value),
        )}
        placeholder={mode === 'percent' ? '0' : '0,00'}
        className='min-w-0 flex-1 border-0 bg-transparent px-3 text-xs outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50'
      />
      <button
        type='button'
        disabled={disabled}
        onClick={onModeToggle}
        className='flex w-9 shrink-0 items-center justify-center border-l border-input bg-primary text-xs font-medium text-primary-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-50'
      >
        {mode === 'fixed' ? 'R$' : '%'}
      </button>
    </div>
  )
}
