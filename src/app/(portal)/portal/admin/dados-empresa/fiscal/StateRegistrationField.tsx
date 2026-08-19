'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function StateRegistrationField (props: {
  defaultValue?: string | null
  defaultExempt?: boolean
}) {
  const [isExempt, setIsExempt] = useState(Boolean(props.defaultExempt))

  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-between gap-3'>
        <Label htmlFor='stateRegistration'>IE</Label>
        <label htmlFor='stateRegistrationExempt' className='flex items-center gap-1.5 text-xs text-muted-foreground'>
          <input
            id='stateRegistrationExempt'
            type='checkbox'
            name='stateRegistrationExempt'
            checked={isExempt}
            onChange={(event) => setIsExempt(event.target.checked)}
            className='h-3.5 w-3.5'
          />
          Isento
        </label>
      </div>
      <Input
        id='stateRegistration'
        name='stateRegistration'
        defaultValue={props.defaultValue || ''}
        disabled={isExempt}
        autoComplete='off'
        placeholder={isExempt ? 'Isento' : undefined}
      />
      <p className='text-xs text-muted-foreground'>
        Este campo só entra no XML. A SEFAZ precisa ter a mesma IE no CAD-ICMS do ambiente (homologação ou produção).
      </p>
    </div>
  )
}
