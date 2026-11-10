'use client'

import type { FocusEvent } from 'react'
import { Input } from '@/components/ui/input'
import {
  formatMoneyInput,
  formatMoneyInputSigned,
  maskedFromCents,
} from '@/lib/utils/money'
import { cn } from '@/lib/utils'

type MoneyInputProps = {
  id?: string
  name?: string
  value?: string
  valueCents?: number | null
  onChange?: (masked: string) => void
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void
  allowNegative?: boolean
  disabled?: boolean
  readOnly?: boolean
  required?: boolean
  placeholder?: string
  className?: string
  defaultValue?: string
}

export function MoneyInput ({
  id,
  name,
  value,
  valueCents,
  onChange,
  onBlur,
  allowNegative = false,
  disabled,
  readOnly,
  required,
  placeholder = '0,00',
  className,
  defaultValue,
}: MoneyInputProps) {
  const format = allowNegative ? formatMoneyInputSigned : formatMoneyInput
  const resolvedValue = value !== undefined
    ? value
    : valueCents !== undefined
      ? maskedFromCents(valueCents)
      : undefined

  return (
    <Input
      id={id}
      name={name}
      value={resolvedValue}
      defaultValue={resolvedValue === undefined ? defaultValue : undefined}
      onChange={(event) => {
        if (disabled || readOnly) return
        const next = format(event.target.value)
        if (resolvedValue === undefined) event.target.value = next
        onChange?.(next)
      }}
      onBlur={onBlur}
      disabled={disabled}
      readOnly={readOnly}
      required={required}
      placeholder={placeholder}
      inputMode='numeric'
      autoComplete='off'
      className={cn(className)}
    />
  )
}
