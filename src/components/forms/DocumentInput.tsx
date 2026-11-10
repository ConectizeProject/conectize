'use client'

import { Input } from '@/components/ui/input'
import { formatCnpj, formatCpf, formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
import { cn } from '@/lib/utils'

type DocumentMode = 'cpf' | 'cnpj' | 'cpf-cnpj'

type DocumentInputProps = {
  id?: string
  name?: string
  value: string
  onChange: (value: string) => void
  mode?: DocumentMode
  disabled?: boolean
  readOnly?: boolean
  required?: boolean
  placeholder?: string
  className?: string
  autoComplete?: string
}

function formatByMode (value: string, mode: DocumentMode) {
  if (mode === 'cpf') return formatCpf(value)
  if (mode === 'cnpj') return formatCnpj(value)
  return formatCpfCnpj(value)
}

function placeholderByMode (mode: DocumentMode) {
  if (mode === 'cpf') return '000.000.000-00'
  if (mode === 'cnpj') return '00.000.000/0000-00'
  return 'CPF ou CNPJ'
}

export function DocumentInput ({
  id,
  name,
  value,
  onChange,
  mode = 'cpf-cnpj',
  disabled,
  readOnly,
  required,
  placeholder,
  className,
  autoComplete = 'off',
}: DocumentInputProps) {
  return (
    <Input
      id={id}
      name={name}
      value={formatByMode(value, mode)}
      onChange={(event) => {
        if (disabled || readOnly) return
        onChange(formatByMode(event.target.value, mode))
      }}
      disabled={disabled}
      readOnly={readOnly}
      required={required}
      placeholder={placeholder || placeholderByMode(mode)}
      inputMode='numeric'
      autoComplete={autoComplete}
      className={cn(className)}
    />
  )
}
