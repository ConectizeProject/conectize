'use client'

import { useMemo, useState } from 'react'
import { DocumentInput } from '@/components/forms'

export function DocumentMaskedInput (props: {
  id?: string
  name: string
  defaultValue?: string
  placeholder?: string
  mode?: 'cpf' | 'cnpj' | 'cpf-cnpj'
}) {
  const initial = useMemo(() => String(props.defaultValue || ''), [props.defaultValue])
  const [value, setValue] = useState(initial)

  return (
    <DocumentInput
      id={props.id || props.name}
      name={props.name}
      value={value}
      onChange={setValue}
      mode={props.mode || 'cpf-cnpj'}
      placeholder={props.placeholder}
    />
  )
}
