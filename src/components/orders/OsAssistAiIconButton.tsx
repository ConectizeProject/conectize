'use client'

import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { toastChatgptAssistFailure } from './chatgpt-assist-error-toast'

type Props = {
  /** Em formulários com defaultValue (edição): leitura/escrita pelo id no DOM */
  fieldId?: string
  /** Em formulários controlados (nova OS): valor atual */
  value?: string
  /** Em formulários controlados: callback com o texto melhorado */
  onImproved?: (text: string) => void
  /** Aparelho/dispositivo da OS para a IA usar no contexto */
  device?: string
  disabled?: boolean
}

export function OsAssistAiIconButton({ fieldId, value = '', onImproved, device, disabled }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    const currentText =
      fieldId && typeof document !== 'undefined'
        ? (document.getElementById(fieldId) as HTMLTextAreaElement | null)?.value ?? ''
        : value

    setLoading(true)
    try {
      const res = await fetch('/api/portal/hub/chatgpt/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'improve_description',
          context: {
            description: currentText || '(vazio)',
            device: device ? String(device).trim() : undefined,
          },
        }),
      })
      const data = await res.json().catch(() => null)

      if (!res.ok) {
        toastChatgptAssistFailure(data)
        return
      }
      if (!data?.text) return

      const improved = String(data.text).trim()
      if (fieldId && typeof document !== 'undefined') {
        const el = document.getElementById(fieldId) as HTMLTextAreaElement | null
        if (el) {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype,
            'value'
          )?.set
          if (nativeInputValueSetter) {
            nativeInputValueSetter.call(el, improved)
            el.dispatchEvent(new Event('input', { bubbles: true }))
          } else {
            el.value = improved
            el.dispatchEvent(new Event('input', { bubbles: true }))
          }
        }
      } else if (onImproved) {
        onImproved(improved)
      }

      if (improved !== (currentText || '').trim()) {
        toast({ title: 'Texto atualizado', description: 'A IA revisou o texto com sucesso.' })
      } else {
        toast({ title: 'Sem alterações', description: 'A IA manteve o texto como está.' })
      }
    } finally {
      setLoading(false)
    }
  }

  if (disabled) return null

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
      disabled={loading}
      onClick={handleClick}
      title="Melhorar texto com IA"
      aria-label="Melhorar texto com IA"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
    </Button>
  )
}
