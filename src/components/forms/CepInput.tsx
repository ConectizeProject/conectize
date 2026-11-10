'use client'

import { Input } from '@/components/ui/input'
import { formatCepBr } from '@/lib/utils/format-cep'
import { cn } from '@/lib/utils'

type CepInputProps = {
  id?: string
  name?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  readOnly?: boolean
  required?: boolean
  placeholder?: string
  className?: string
  autoComplete?: string
  onBlur?: () => void
}

export function CepInput ({
  id,
  name,
  value,
  onChange,
  disabled,
  readOnly,
  required,
  placeholder = '00000-000',
  className,
  autoComplete = 'postal-code',
  onBlur,
}: CepInputProps) {
  return (
    <Input
      id={id}
      name={name}
      value={formatCepBr(value)}
      onChange={(event) => {
        if (disabled || readOnly) return
        onChange(formatCepBr(event.target.value))
      }}
      onBlur={onBlur}
      disabled={disabled}
      readOnly={readOnly}
      required={required}
      placeholder={placeholder}
      inputMode='numeric'
      autoComplete={autoComplete}
      className={cn(className)}
    />
  )
}
