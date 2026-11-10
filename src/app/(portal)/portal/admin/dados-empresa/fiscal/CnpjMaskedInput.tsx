'use client'

import { useMemo, useState } from 'react'
import { DocumentInput } from '@/components/forms'

export function CnpjMaskedInput (props: {
  id?: string
  name: string
  defaultValue?: string | null
  placeholder?: string
  className?: string
}) {
  const initial = useMemo(() => String(props.defaultValue || ''), [props.defaultValue])
  const [value, setValue] = useState(initial)

  return (
    <DocumentInput
      id={props.id}
      name={props.name}
      value={value}
      onChange={setValue}
      mode='cnpj'
      placeholder={props.placeholder || '00.000.000/0000-00'}
      className={props.className}
    />
  )
}
