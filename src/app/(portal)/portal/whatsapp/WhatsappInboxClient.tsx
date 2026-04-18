'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { Bot, CheckCircle2, Loader2, MessageCircle, RotateCcw, Send } from 'lucide-react'
import { createOrderFromWhatsappConversationAction } from './whatsapp-create-order-action'
import { Textarea } from '@/components/ui/textarea'

type Conv = {
  id: string
  wa_from: string
  last_message_at: string
  needs_staff_attention: boolean
  draft_os: Record<string, string> | null
  service_order_id: string | null
  last_preview: string | null
  service_orders?: { display_number: number | null } | null
}

type Msg = {
  id: string
  direction: string
  body: string | null
  status: string
  resolved_by: string | null
  needs_human: boolean
  created_at: string
  payload?: { source?: string }
}

export function WhatsappInboxClient () {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [conversations, setConversations] = useState<Conv[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [creatingOrder, setCreatingOrder] = useState(false)

  const loadList = useCallback(async () => {
    const res = await fetch('/api/portal/whatsapp/conversations')
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok) {
      toast({ title: 'Erro ao carregar conversas', variant: 'destructive' })
      return
    }
    setConversations(data.conversations || [])
    return data.conversations as Conv[]
  }, [])

  useEffect(() => {
    void (async () => {
      setLoading(true)
      const list = await loadList()
      setLoading(false)
      if (list && list.length > 0) {
        setSelectedId((prev) => prev ?? list[0].id)
      }
    })()
  }, [loadList])

  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      return
    }
    let cancelled = false
    void (async () => {
      setLoadingMsgs(true)
      const res = await fetch(`/api/portal/whatsapp/conversations/${selectedId}/messages`)
      const data = await res.json().catch(() => null)
      if (!cancelled && res.ok && data?.ok) {
        setMessages(data.messages || [])
      }
      if (!cancelled) setLoadingMsgs(false)
    })()
    return () => {
      cancelled = true
    }
  }, [selectedId])

  async function handleMarkAttended () {
    if (!selectedId) return
    const res = await fetch(`/api/portal/whatsapp/conversations/${selectedId}/mark-attended`, {
      method: 'POST',
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok) {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' })
      return
    }
    toast({ variant: 'success', title: 'Marcado como atendido' })
    void loadList()
    router.refresh()
  }

  async function handleReopen () {
    if (!selectedId) return
    const res = await fetch(`/api/portal/whatsapp/conversations/${selectedId}/reopen`, { method: 'POST' })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok) {
      toast({ title: 'Erro ao reabrir', variant: 'destructive' })
      return
    }
    toast({ variant: 'success', title: 'Conversa pendente novamente' })
    void loadList()
  }

  async function handleSend () {
    if (!selectedId || !reply.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/portal/whatsapp/conversations/${selectedId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: reply.trim() }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast({ title: 'Erro ao enviar', description: String(data?.error || ''), variant: 'destructive' })
        return
      }
      setReply('')
      const r2 = await fetch(`/api/portal/whatsapp/conversations/${selectedId}/messages`)
      const d2 = await r2.json().catch(() => null)
      if (r2.ok && d2?.ok) setMessages(d2.messages || [])
      void loadList()
    } finally {
      setSending(false)
    }
  }

  async function handleCreateOrder () {
    if (!selectedId) return
    setCreatingOrder(true)
    try {
      const result = await createOrderFromWhatsappConversationAction(selectedId)
      if (result.ok === false) {
        const code = result.error
        toast({
          title: 'Não foi possível criar a OS',
          description:
            code === 'draft_incomplete'
              ? 'Preencha nome, CPF (11 dígitos) e descrição do problema no fluxo com o cliente (IA).'
              : code,
          variant: 'destructive',
        })
        return
      }
      router.push(result.redirectTo)
    } finally {
      setCreatingOrder(false)
    }
  }

  const selected = conversations.find((c) => c.id === selectedId)
  const draft = selected?.draft_os || null

  return (
    <div className="grid min-h-[420px] flex-1 gap-4 lg:grid-cols-[minmax(220px,280px)_1fr]">
      <div className="flex max-h-[70vh] flex-col overflow-hidden rounded-xl border bg-muted/20">
        <div className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">Conversas</div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Nenhuma conversa ainda.</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={cn(
                  'flex w-full flex-col gap-0.5 border-b px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60',
                  selectedId === c.id && 'bg-muted/80',
                )}
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <MessageCircle className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                  {c.wa_from}
                  {c.needs_staff_attention ? (
                    <span className="ml-auto rounded bg-amber-500/20 px-1.5 py-0 text-[10px] font-semibold text-amber-800 dark:text-amber-200">
                      pendente
                    </span>
                  ) : (
                    <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-emerald-600" aria-hidden />
                  )}
                </span>
                {c.last_preview ? (
                  <span className="line-clamp-2 text-xs text-muted-foreground">{c.last_preview}</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex min-h-[420px] flex-col rounded-xl border">
        {!selectedId ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Selecione uma conversa
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
              <span className="font-mono text-sm">{selected?.wa_from}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => void handleMarkAttended()}>
                Marcar como atendido
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => void handleReopen()}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                Reabrir
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={creatingOrder || !!selected?.service_order_id}
                onClick={() => void handleCreateOrder()}
              >
                {creatingOrder ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                Criar OS a partir do chat
              </Button>
              {selected?.service_order_id && selected.service_orders?.display_number != null ? (
                <Button type="button" variant="link" size="sm" asChild>
                  <Link href={`/portal/ordens/${selected.service_orders.display_number}`}>Ver OS vinculada</Link>
                </Button>
              ) : null}
            </div>

            {draft && Object.keys(draft).length > 0 ? (
              <div className="border-b bg-muted/30 px-3 py-2 text-xs">
                <span className="font-medium">Rascunho (IA): </span>
                <span className="text-muted-foreground">
                  {JSON.stringify(draft)}
                </span>
              </div>
            ) : null}

            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {loadingMsgs ? (
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                messages.map((m) => {
                  const fromAi = m.direction === 'out' && m.payload?.source === 'ai'
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        'max-w-[min(100%,420px)] rounded-lg px-3 py-2 text-sm',
                        m.direction === 'in'
                          ? 'mr-auto bg-muted'
                          : 'ml-auto bg-primary text-primary-foreground',
                      )}
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-1 text-[10px] opacity-90">
                        {fromAi ? (
                          <span className="inline-flex items-center gap-0.5 rounded bg-background/20 px-1 py-0">
                            <Bot className="h-3 w-3" /> IA
                          </span>
                        ) : null}
                        {m.needs_human && m.status === 'pending' ? (
                          <span className="rounded bg-amber-500/30 px-1 py-0 text-[10px]">aguardando revisão</span>
                        ) : null}
                      </div>
                      <p className="whitespace-pre-wrap">{m.body || '—'}</p>
                    </div>
                  )
                })
              )}
            </div>

            <div className="border-t p-3">
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Resposta manual…"
                rows={3}
                className="mb-2"
              />
              <Button type="button" onClick={() => void handleSend()} disabled={sending || !reply.trim()}>
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Enviar
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
