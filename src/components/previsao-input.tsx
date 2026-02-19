'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { isPrevisaoValid } from '@/lib/utils/previsao-ordem'

const ERROR_MSG = 'A previsão deve ser igual ou posterior à data de abertura.'

type PrevisaoInputProps = {
  min: string
  name: string
  id: string
  disabled?: boolean
  className?: string
} & (
  | { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; defaultValue?: never }
  | { value?: never; onChange?: never; defaultValue: string }
)

export function PrevisaoInput(props: PrevisaoInputProps) {
  const { min, name, id, disabled, className } = props
  const isControlled = props.value !== undefined
  const onChangeRef = useRef('onChange' in props ? props.onChange : undefined)
  useEffect(() => {
    if ('onChange' in props) onChangeRef.current = props.onChange
  })

  const [uncontrolledValue, setUncontrolledValue] = useState(
    !isControlled && props.defaultValue !== undefined ? props.defaultValue : ''
  )
  const value = isControlled ? props.value : uncontrolledValue
  const invalid = value ? !isPrevisaoValid(value, min) : false

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value
      if (isControlled && onChangeRef.current) onChangeRef.current(e)
      else setUncontrolledValue(v)
    },
    [isControlled]
  )

  return (
    <div className="space-y-2">
      <Input
        id={id}
        name={name}
        type="datetime-local"
        min={min}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        className={invalid ? `${className ?? ''} border-destructive`.trim() : className}
        aria-invalid={invalid}
      />
      {invalid && <p className="text-sm text-destructive">{ERROR_MSG}</p>}
    </div>
  )
}
