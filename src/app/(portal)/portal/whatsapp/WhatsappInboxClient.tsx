'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import {
  Bot,
  CheckCircle2,
  Loader2,
  MoreHorizontal,
  RotateCcw,
  Search,
  Send,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react'
import {
  formatWaConversationLabel,
  isGroupWaKey,
} from '@/lib/whatsapp/wa-conversation-key'
import { createOrderFromWhatsappConversationAction } from './whatsapp-create-order-action'
import { Textarea } from '@/components/ui/textarea'

type Conv = {
  id: string
  wa_from: string
  hub_connection_id: string | null
  last_message_at: string
  needs_staff_attention: boolean
  draft_os: Record<string, string> | null
  state?: { display_name?: string; is_group?: boolean; evolution_instance?: string } | null
  service_order_id: string | null
  last_preview: string | null
  service_orders?: { display_number: number | null } | null
}

type Channel = {
  channel_id: string
  channel_type: 'evolution' | 'cloud' | 'legacy'
  label: string
  instance_name: string | null
  hub_connection_id: string | null
  conversations: Conv[]
}

type Msg = {
  id: string
  direction: string
  body: string | null
  status: string
  resolved_by: string | null
  needs_human: boolean
  created_at: string
  deleted_at: string | null
  payload?: { source?: string; channel?: string }
}

function isGroupConversation (c: Conv): boolean {
  return c.state?.is_group === true || isGroupWaKey(c.wa_from)
}

function conversationMatchesSearch (c: Conv, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const label = formatWaConversationLabel(c.wa_from, c.state).toLowerCase()
  const wa = c.wa_from.toLowerCase()
  const preview = (c.last_preview || '').toLowerCase()
  const qDigits = q.replace(/\D/g, '')
  const waDigits = c.wa_from.replace(/\D/g, '')
  if (label.includes(q) || wa.includes(q) || preview.includes(q)) return true
  if (qDigits.length >= 3 && waDigits.includes(qDigits)) return true
  return false
}

function ConversationRow ({
  conv,
  selected,
  deleting,
  onSelect,
  onDelete,
}: {
  conv: Conv
  selected: boolean
  deleting: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const isGroup = isGroupConversation(conv)
  return (
    <div
      className={cn(
        'group relative border-b transition-colors hover:bg-muted/60',
        selected && 'bg-muted/80',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        disabled={deleting}
        className="flex w-full flex-col gap-0.5 px-3 py-2.5 pr-10 text-left text-sm disabled:opacity-60"
      >
        <span className="flex items-center gap-1.5 font-medium">
          {isGroup ? (
            <Users className="h-3.5 w-3.5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
          ) : (
            <UserRound className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
          )}
          <span className="min-w-0 truncate">{formatWaConversationLabel(conv.wa_from, conv.state)}</span>
          {conv.needs_staff_attention ? (
            <span className="ml-auto shrink-0 rounded bg-amber-500/20 px-1.5 py-0 text-[10px] font-semibold text-amber-800 dark:text-amber-200">
              pendente
            </span>
          ) : (
            <CheckCircle2 className="ml-auto h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
          )}
        </span>
        {!isGroup ? (
          <span className="truncate pl-5 font-mono text-[11px] text-muted-foreground">{conv.wa_from}</span>
        ) : null}
        {conv.last_preview ? (
          <span className="line-clamp-2 pl-5 text-xs text-muted-foreground">{conv.last_preview}</span>
        ) : null}
      </button>
      <div
        className={cn(
          'absolute right-1 top-2 transition-opacity',
          deleting ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
        )}
      >
        {deleting ? (
          <span className="flex h-7 w-7 items-center justify-center" aria-hidden>
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </span>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Ações da conversa"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir do portal
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}

type ListTab = 'contacts' | 'groups'

export function WhatsappInboxClient () {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [channels, setChannels] = useState<Channel[]>([])
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [creatingOrder, setCreatingOrder] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeListTab, setActiveListTab] = useState<ListTab>('contacts')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const activeChannel = useMemo(
    () => channels.find((c) => c.channel_id === activeChannelId) ?? null,
    [channels, activeChannelId],
  )

  const visibleConversations = activeChannel?.conversations ?? []

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return visibleConversations
    return visibleConversations.filter((c) => conversationMatchesSearch(c, searchQuery))
  }, [visibleConversations, searchQuery])

  const directConversations = useMemo(
    () => filteredConversations.filter((c) => !isGroupConversation(c)),
    [filteredConversations],
  )

  const groupConversations = useMemo(
    () => filteredConversations.filter((c) => isGroupConversation(c)),
    [filteredConversations],
  )

  const tabConversations = useMemo(
    () => (activeListTab === 'contacts' ? directConversations : groupConversations),
    [activeListTab, directConversations, groupConversations],
  )

  const loadList = useCallback(async () => {
    const res = await fetch('/api/portal/whatsapp/conversations')
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok) {
      toast({ title: 'Erro ao carregar conversas', variant: 'destructive' })
      return
    }
    const ch = (data.channels || []) as Channel[]
    setChannels(ch)
    return ch
  }, [])

  useEffect(() => {
    void (async () => {
      setLoading(true)
      const ch = await loadList()
      setLoading(false)
      if (ch && ch.length > 0) {
        setActiveChannelId((prev) => prev ?? ch[0].channel_id)
      }
    })()
  }, [loadList])

  useEffect(() => {
    if (!activeChannelId) return
    const ch = channels.find((c) => c.channel_id === activeChannelId)
    if (!ch?.conversations.length) {
      setSelectedId(null)
      return
    }
    const contacts = ch.conversations.filter((c) => !isGroupConversation(c))
    const groups = ch.conversations.filter((c) => isGroupConversation(c))
    setSelectedId((prev) => {
      if (prev && ch.conversations.some((c) => c.id === prev)) return prev
      return contacts[0]?.id ?? groups[0]?.id ?? null
    })
    setActiveListTab(contacts.length > 0 ? 'contacts' : 'groups')
  }, [activeChannelId, channels])

  useEffect(() => {
    setSearchQuery('')
  }, [activeChannelId])

  useEffect(() => {
    if (!selectedId) {
      if (tabConversations[0]) setSelectedId(tabConversations[0].id)
      return
    }
    if (!tabConversations.some((c) => c.id === selectedId)) {
      setSelectedId(tabConversations[0]?.id ?? null)
    }
  }, [tabConversations, selectedId])

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

  async function handleDeleteConversation (id: string) {
    const conv =
      visibleConversations.find((c) => c.id === id) ??
      tabConversations.find((c) => c.id === id)
    const label = conv ? formatWaConversationLabel(conv.wa_from, conv.state) : 'esta conversa'
    if (
      !confirm(
        `Remover "${label}" do portal?\n\nAs mensagens salvas aqui também serão apagadas. Isso não exclui o chat no WhatsApp.`,
      )
    ) {
      return
    }

    setDeletingId(id)
    try {
      const res = await fetch(`/api/portal/whatsapp/conversations/${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast({
          title: 'Não foi possível excluir',
          description: data?.error === 'not_found' ? 'Conversa não encontrada.' : 'Tente novamente.',
          variant: 'destructive',
        })
        return
      }
      if (selectedId === id) {
        setSelectedId(null)
        setMessages([])
      }
      toast({ variant: 'success', title: 'Conversa removida do portal' })
      await loadList()
      router.refresh()
    } finally {
      setDeletingId(null)
    }
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
        const hint = String((data as { hint?: string })?.hint || '')
        const err = String(data?.error || '')
        toast({
          title: 'Erro ao enviar',
          description: hint || err || 'Tente novamente.',
          variant: 'destructive',
        })
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

  const selected =
    visibleConversations.find((c) => c.id === selectedId) ??
    filteredConversations.find((c) => c.id === selectedId)
  const draft = selected?.draft_os || null

  return (
    <div className="flex min-h-[420px] flex-1 flex-col gap-3">
      {channels.length > 1 ? (
        <div
          className="flex flex-wrap gap-2 border-b pb-2"
          role="tablist"
          aria-label="Instâncias WhatsApp"
        >
          {channels.map((ch) => (
            <button
              key={ch.channel_id}
              type="button"
              role="tab"
              aria-selected={activeChannelId === ch.channel_id}
              onClick={() => setActiveChannelId(ch.channel_id)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                activeChannelId === ch.channel_id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted',
              )}
            >
              {ch.label}
              <span className="ml-1.5 text-xs opacity-70">({ch.conversations.length})</span>
            </button>
          ))}
        </div>
      ) : activeChannel ? (
        <p className="text-sm text-muted-foreground">
          Canal: <span className="font-medium text-foreground">{activeChannel.label}</span>
        </p>
      ) : null}

      <div className="grid min-h-[420px] flex-1 gap-4 lg:grid-cols-[minmax(220px,280px)_1fr]">
        <div className="flex max-h-[70vh] flex-col overflow-hidden rounded-xl border bg-muted/20">
          <div className="space-y-2 border-b px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground">
              Conversas
              {activeChannel ? ` — ${activeChannel.label}` : ''}
            </p>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar nome, número ou mensagem…"
                className="h-8 pl-8 text-sm"
                aria-label="Buscar conversa"
              />
            </div>
            <div
              className="grid grid-cols-2 gap-1 rounded-lg bg-muted/60 p-0.5"
              role="tablist"
              aria-label="Tipo de conversa"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeListTab === 'contacts'}
                onClick={() => setActiveListTab('contacts')}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                  activeListTab === 'contacts'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Contatos
                <span className="tabular-nums opacity-70">({directConversations.length})</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeListTab === 'groups'}
                onClick={() => setActiveListTab('groups')}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                  activeListTab === 'groups'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Grupos
                <span className="tabular-nums opacity-70">({groupConversations.length})</span>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : visibleConversations.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                Nenhuma conversa neste canal. Sincronize no Hub ou aguarde mensagens.
              </p>
            ) : filteredConversations.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                Nenhum resultado para &quot;{searchQuery.trim()}&quot;.
              </p>
            ) : tabConversations.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                {activeListTab === 'contacts'
                  ? 'Nenhum contato encontrado.'
                  : 'Nenhum grupo encontrado.'}
              </p>
            ) : (
              tabConversations.map((c) => (
                <ConversationRow
                  key={c.id}
                  conv={c}
                  selected={selectedId === c.id}
                  deleting={deletingId === c.id}
                  onSelect={() => setSelectedId(c.id)}
                  onDelete={() => void handleDeleteConversation(c.id)}
                />
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
                <span className="text-sm font-medium">
                  {selected
                    ? formatWaConversationLabel(selected.wa_from, selected.state)
                    : ''}
                </span>
                {selected && !isGroupConversation(selected) ? (
                  <span className="font-mono text-xs text-muted-foreground">{selected.wa_from}</span>
                ) : null}
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
                  <span className="text-muted-foreground">{JSON.stringify(draft)}</span>
                </div>
              ) : null}

              <div className="flex-1 space-y-2 overflow-y-auto p-3">
                {loadingMsgs ? (
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                ) : (
                  messages.map((m) => {
                    const fromAi = m.direction === 'out' && m.payload?.source === 'ai'
                    const fromPhone =
                      m.direction === 'out' && m.payload?.source === 'whatsapp_device'
                    const isDeleted = Boolean(m.deleted_at)
                    return (
                      <div
                        key={m.id}
                        className={cn(
                          'max-w-[min(100%,420px)] rounded-lg px-3 py-2 text-sm',
                          isDeleted
                            ? 'mr-auto border border-destructive/40 bg-destructive/10 text-destructive'
                            : m.direction === 'in'
                              ? 'mr-auto bg-muted'
                              : 'ml-auto bg-primary text-primary-foreground',
                        )}
                      >
                        <div className="mb-1 flex flex-wrap items-center gap-1 text-[10px] opacity-90">
                          {isDeleted ? (
                            <span className="rounded bg-destructive/20 px-1 py-0 font-medium text-destructive">
                              excluída no WhatsApp
                            </span>
                          ) : null}
                          {fromAi ? (
                            <span className="inline-flex items-center gap-0.5 rounded bg-background/20 px-1 py-0">
                              <Bot className="h-3 w-3" /> IA
                            </span>
                          ) : null}
                          {fromPhone ? (
                            <span className="inline-flex items-center gap-0.5 rounded bg-background/20 px-1 py-0">
                              Celular
                            </span>
                          ) : null}
                          {m.needs_human && m.status === 'pending' && !isDeleted ? (
                            <span className="rounded bg-amber-500/30 px-1 py-0 text-[10px]">
                              aguardando revisão
                            </span>
                          ) : null}
                        </div>
                        <p
                          className={cn(
                            'whitespace-pre-wrap',
                            isDeleted && 'line-through decoration-destructive/80',
                          )}
                        >
                          {m.body || '—'}
                        </p>
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
    </div>
  )
}
