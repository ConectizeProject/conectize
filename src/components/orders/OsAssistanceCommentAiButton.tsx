'use client'

import { useEffect, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'

export type AssistanceCommentAiContext = {
  device?: string
  customerDescription?: string
  receivingNotes?: string
  previousCommentsSummary?: string
}

type Props = {
  draft: string
  onResult: (text: string) => void
  context?: AssistanceCommentAiContext | null
  disabled?: boolean
}

export function OsAssistanceCommentAiButton({ draft, onResult, context, disabled }: Props) {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/portal/hub/chatgpt/status')
      .then((res) => res.json())
      .then((data) => setConnected(Boolean(data?.connected)))
      .catch(() => setConnected(false))
  }, [])

  async function handleClick() {
    if (connected === false) {
      toast({
        title: 'IA não conectada',
        description: 'Conecte o ChatGPT no HUB de integrações para usar esta função.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/portal/hub/chatgpt/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assist_assistance_comment',
          context: {
            draft: draft.trim(),
            device: context?.device ? String(context.device).trim() : undefined,
            customerDescription: context?.customerDescription
              ? String(context.customerDescription).trim()
              : undefined,
            receivingNotes: context?.receivingNotes ? String(context.receivingNotes).trim() : undefined,
            previousCommentsSummary: context?.previousCommentsSummary
              ? String(context.previousCommentsSummary).trim()
              : undefined,
          },
        }),
      })
      const data = await res.json().catch(() => null)

      if (!res.ok) {
        const msg = data?.message || data?.error || 'Erro ao usar a IA'
        toast({ title: 'Erro na IA', description: msg, variant: 'destructive' })
        return
      }
      if (!data?.text) return

      const text = String(data.text).trim()
      if (!text) return

      onResult(text)

      if (text !== draft.trim()) {
        toast({ title: 'Texto da IA aplicado', description: 'Revise antes de enviar o comentário.' })
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
      title="Sugerir ou melhorar comentário com IA"
      aria-label="Sugerir ou melhorar comentário com IA"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
    </Button>
  )
}
