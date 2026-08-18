'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'

function formatCnpj (value: string) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 14)
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return digits.replace(/^(\d{2})(\d+)/, '$1.$2')
  if (digits.length <= 8) return digits.replace(/^(\d{2})(\d{3})(\d+)/, '$1.$2.$3')
  if (digits.length <= 12) return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d+)/, '$1.$2.$3/$4')
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/, '$1.$2.$3/$4-$5')
}

export function CnpjMaskedInput (props: {
  id?: string
  name: string
  defaultValue?: string | null
  placeholder?: string
  className?: string
}) {
  const initial = useMemo(() => formatCnpj(String(props.defaultValue || '')), [props.defaultValue])
  const [value, setValue] = useState(initial)

  return (
    <Input
      id={props.id}
      name={props.name}
      value={value}
      onChange={(event) => setValue(formatCnpj(event.target.value))}
      placeholder={props.placeholder || '00.000.000/0000-00'}
      inputMode='numeric'
      autoComplete='off'
      className={props.className}
    />
  )
}
