'use client'

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { PatternLockInput } from '@/components/pattern-lock/PatternLockInput'

type PasscodeType = 'none' | 'text' | 'pattern'

type Props = {
  defaultPasscodeType: PasscodeType
  defaultPasscodeText: string
  defaultPasscodePattern: string
  disabled?: boolean
}

export function OrderPasscodeFields(props: Props) {
  const [passcodeType, setPasscodeType] = useState<PasscodeType>(props.defaultPasscodeType)
  const [passcodeText, setPasscodeText] = useState(props.defaultPasscodeText)
  const [passcodePattern, setPasscodePattern] = useState(props.defaultPasscodePattern)
  const disabled = props.disabled ?? false

  return (
    <div className="rounded-md border p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-medium">Senha do aparelho</div>
          <div className="text-xs text-muted-foreground">Texto ou padrão (desenho)</div>
        </div>
      </div>

      <input type="hidden" name="passcodeType" value={passcodeType} />
      <input type="hidden" name="passcodePattern" value={passcodePattern} />

      <RadioGroup
        value={passcodeType}
        onValueChange={(v) => {
          if (disabled) return
          const next = v === 'pattern' ? 'pattern' : (v === 'text' ? 'text' : 'none')
          setPasscodeType(next)
          if (next === 'none') {
            setPasscodeText('')
            setPasscodePattern('')
          }
        }}
        className="flex flex-wrap items-center gap-4"
        disabled={disabled}
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="text" id="passcode-text" disabled={disabled} />
          <Label htmlFor="passcode-text" className="cursor-pointer">Texto</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="pattern" id="passcode-pattern" disabled={disabled} />
          <Label htmlFor="passcode-pattern" className="cursor-pointer">Padrão</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="none" id="passcode-none" disabled={disabled} />
          <Label htmlFor="passcode-none" className="cursor-pointer">Não informar</Label>
        </div>
      </RadioGroup>

      {passcodeType === 'text' ? (
        <div className="space-y-2">
          <Label htmlFor="passcodeText">Senha (texto)</Label>
          <Input
            id="passcodeText"
            name="passcodeText"
            value={passcodeText}
            onChange={(e) => !disabled && setPasscodeText(e.target.value)}
            placeholder="Ex: 1234, senha do iCloud, etc."
            disabled={disabled}
          />
        </div>
      ) : passcodeType === 'pattern' ? (
        <div className="space-y-2">
          <Label htmlFor="passcodePattern">Senha (padrão)</Label>
          <PatternLockInput id="passcodePattern" value={passcodePattern} onChange={disabled ? () => {} : setPasscodePattern} disabled={disabled} />
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">
          O cliente optou por não informar a senha.
        </div>
      )}
    </div>
  )
}
