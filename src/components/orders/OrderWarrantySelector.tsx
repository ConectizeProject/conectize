'use client'

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

type WarrantyTemplate = {
  id: string
  name: string
  body: string
  is_active?: boolean
  is_default?: boolean
}

type Props = {
  templates: WarrantyTemplate[]
  initialTemplateId: string | null
  initialText: string | null
  formId: string
  disabled?: boolean
}

export function OrderWarrantySelector ({
  templates,
  initialTemplateId,
  initialText,
  formId,
  disabled,
}: Props) {
  const activeTemplates = templates.filter((t) => t.is_active ?? true)

  const [selectedId, setSelectedId] = useState<string>(() => {
    if (initialTemplateId) return initialTemplateId
    return '__none__'
  })
  const [text, setText] = useState<string>(() => initialText || '')

  function handleTemplateChange (value: string) {
    setSelectedId(value)
    if (value === '__none__') {
      setText(initialText || '')
      return
    }
    const tmpl = activeTemplates.find((t) => t.id === value)
    if (tmpl) {
      setText(tmpl.body || '')
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="warrantyTemplateId">Modelo de garantia</Label>
      </div>
      <input
        type="hidden"
        name="warrantyTemplateId"
        form={formId}
        value={selectedId === '__none__' ? '' : selectedId}
        readOnly
        aria-hidden
      />
      <Select
        value={selectedId || '__none__'}
        onValueChange={handleTemplateChange}
        disabled={disabled || activeTemplates.length === 0}
      >
        <SelectTrigger form={formId} id="warrantyTemplateId">
          <SelectValue placeholder={activeTemplates.length === 0 ? 'Nenhum modelo cadastrado' : 'Selecione um modelo (opcional)'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Nenhum</SelectItem>
          {activeTemplates.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
              {t.is_default ? ' (padrão)' : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="space-y-1">
        <Label htmlFor="warrantyText">Texto de garantia</Label>
        <Textarea
          id="warrantyText"
          name="warrantyText"
          form={formId}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Texto que será exibido na impressão e na visão pública. Pode ser ajustado por ordem."
          disabled={disabled}
        />
      </div>
    </div>
  )
}

