'use client'

import { useEffect, useState } from 'react'
import { Bot, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  customerDescription: string
  device?: string
  title?: string
  receivingNotes?: string
  onSuggestTitle: (text: string) => void
  onImproveDescription: (text: string) => void
  onSuggestServices: (descriptions: string[]) => void
  /** Se true, lê título/descrição/observações do DOM antes de chamar a IA (útil em formulários com defaultValue). */
  readContextFromDom?: boolean
  /** IDs dos campos no DOM quando readContextFromDom é true. */
  domIds?: { title?: string; customerDescription?: string; receivingNotes?: string }
}

const defaultDomIds = { title: 'title', customerDescription: 'customerDescription', receivingNotes: 'receivingNotes' }

export function OsAssistAi({
  customerDescription,
  device,
  title,
  receivingNotes,
  onSuggestTitle,
  onImproveDescription,
  onSuggestServices,
  readContextFromDom = false,
  domIds = defaultDomIds,
}: Props) {
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState<'title' | 'description' | 'services' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/portal/hub/chatgpt/status')
      .then((res) => res.json())
      .then((data) => setConnected(Boolean(data?.connected)))
      .catch(() => setConnected(false))
  }, [])

  function getContext() {
    if (readContextFromDom && typeof document !== 'undefined') {
      const get = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? ''
      return {
        title: get(domIds?.title ?? defaultDomIds.title),
        customerDescription: get(domIds?.customerDescription ?? defaultDomIds.customerDescription),
        receivingNotes: get(domIds?.receivingNotes ?? defaultDomIds.receivingNotes),
        device,
      }
    }
    return { title, customerDescription, receivingNotes, device }
  }

  async function callAssist(action: 'suggest_title' | 'improve_description' | 'suggest_services') {
    setError(null)
    setLoading(action === 'suggest_title' ? 'title' : action === 'improve_description' ? 'description' : 'services')
    const context = getContext()

    try {
      const res = await fetch('/api/portal/hub/chatgpt/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          context,
        }),
      })
      const data = await res.json().catch(() => null)

      if (!res.ok) {
        const msg = data?.message || data?.error || 'Erro ao usar a IA'
        setError(msg === 'chatgpt_not_connected' ? 'Conecte o ChatGPT no HUB.' : msg)
        return
      }

      if (action === 'suggest_services' && Array.isArray(data.items)) {
        onSuggestServices(data.items)
      } else if (data.text) {
        if (action === 'suggest_title') onSuggestTitle(data.text)
        else if (action === 'improve_description') onImproveDescription(data.text)
      }
    } finally {
      setLoading(null)
    }
  }

  if (!connected) return null

  return (
    <div className="rounded-lg border border-dashed bg-muted/30 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Bot className="h-4 w-4" />
        Ajuda com IA
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!!loading}
          onClick={() => callAssist('suggest_title')}
        >
          {loading === 'title' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-1" />
          )}
          Sugerir título
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!!loading}
          onClick={() => callAssist('improve_description')}
        >
          {loading === 'description' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-1" />
          )}
          Melhorar descrição
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!!loading}
          onClick={() => callAssist('suggest_services')}
        >
          {loading === 'services' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-1" />
          )}
          Sugerir serviços
        </Button>
      </div>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}
