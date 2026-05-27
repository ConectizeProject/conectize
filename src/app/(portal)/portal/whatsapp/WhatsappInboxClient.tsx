'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import {
  Archive,
  Check,
  CheckCircle2,
  CheckSquare,
  Loader2,
  MoreHorizontal,
  RotateCcw,
  Search,
  Trash2,
  X,
  UserRound,
  Users,
} from 'lucide-react'
import {
  formatWaConversationLabel,
  isGroupWaKey,
} from '@/lib/whatsapp/wa-conversation-key'
import { createOrderFromWhatsappConversationAction } from './whatsapp-create-order-action'
import { useWhatsappInboxRealtime } from '@/hooks/use-whatsapp-inbox-realtime'
import {
  WhatsappChatComposer,
  type WhatsappChatComposerHandle,
} from './WhatsappChatComposer'
import { patchConversationAfterOutboundMessage } from '@/lib/whatsapp/whatsapp-inbox-realtime'
import { WhatsappMessageBubble } from './WhatsappMessageBubble'
import {
  formatWaDayDivider,
  formatWaMessageTime,
  waAvatarHue,
  waDayKey,
  waInitials,
} from './whatsapp-inbox-utils'
import { WaJidHint } from './WaJidHint'

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 400

type ChannelMeta = {
  channel_id: string
  channel_type: 'evolution' | 'cloud' | 'legacy'
  label: string
  instance_name: string | null
  hub_connection_id: string | null
}

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

type Msg = {
  id: string
  direction: string
  body: string | null
  status: string
  resolved_by: string | null
  needs_human: boolean
  created_at: string
  deleted_at: string | null
  payload?: Record<string, unknown>
  media_url?: string | null
  media_expired?: boolean
}

type ListTab = 'contacts' | 'groups'

function isGroupConversation (c: Conv): boolean {
  return c.state?.is_group === true || isGroupWaKey(c.wa_from)
}

function WaAvatar ({
  label,
  isGroup,
  size = 'md',
}: {
  label: string
  isGroup: boolean
  size?: 'md' | 'sm'
}) {
  const hue = waAvatarHue(label)
  const dim = size === 'sm' ? 'h-9 w-9 text-xs' : 'h-12 w-12 text-sm'
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-medium text-white',
        dim,
      )}
      style={{ backgroundColor: isGroup ? '#7c3aed' : `hsl(${hue} 45% 42%)` }}
      aria-hidden
    >
      {isGroup ? <Users className="h-5 w-5" /> : waInitials(label)}
    </span>
  )
}

function ConversationRow ({
  conv,
  selected,
  deleting,
  selectionMode,
  checked,
  onToggleCheck,
  onSelect,
  onMarkRead,
  onArchive,
  onDelete,
}: {
  conv: Conv
  selected: boolean
  deleting: boolean
  selectionMode?: boolean
  checked?: boolean
  onToggleCheck?: () => void
  onSelect: () => void
  onMarkRead: () => void
  onArchive: () => void
  onDelete: () => void
}) {
  const isGroup = isGroupConversation(conv)
  const label = formatWaConversationLabel(conv.wa_from, conv.state)
  const timeLabel = formatWaMessageTime(conv.last_message_at)
  const isUnread = conv.needs_staff_attention

  return (
    <div
      className={cn(
        'group relative transition-colors hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]',
        selected && !selectionMode && 'bg-[#f0f2f5] dark:bg-[#2a3942]',
        selectionMode && checked && 'bg-[#111b21]/5 dark:bg-white/5',
      )}
    >
      {selectionMode ? (
        <div
          role="button"
          tabIndex={deleting ? -1 : 0}
          onClick={deleting ? undefined : onToggleCheck}
          onKeyDown={(e) => {
            if (deleting) return
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onToggleCheck?.()
            }
          }}
          className={cn(
            'flex w-full cursor-pointer items-center gap-3 px-2 py-3 pr-2 text-left',
            deleting && 'pointer-events-none opacity-60',
          )}
        >
          <span
            className="flex shrink-0 items-center py-1"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={checked}
              onCheckedChange={() => onToggleCheck?.()}
              aria-label={checked ? `Desmarcar ${label}` : `Selecionar ${label}`}
            />
          </span>
          <WaAvatar label={label} isGroup={isGroup} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-[17px] text-[#111b21] dark:text-[#e9edef]',
                isUnread ? 'font-semibold' : 'font-normal',
              )}
            >
              {label}
            </span>
            {timeLabel ? (
              <span
                className={cn(
                  'shrink-0 text-xs tabular-nums',
                  isUnread
                    ? 'font-medium text-[#25d366]'
                    : 'text-[#667781] dark:text-[#8696a0]',
                )}
              >
                {timeLabel}
              </span>
            ) : null}
          </span>
          <WaJidHint waFrom={conv.wa_from} />
          <span className="mt-0.5 flex items-center gap-1.5">
            {conv.last_preview ? (
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-sm',
                  isUnread
                    ? 'font-medium text-[#111b21] dark:text-[#e9edef]'
                    : 'font-normal text-[#667781] dark:text-[#8696a0]',
                )}
              >
                {conv.last_preview}
              </span>
            ) : (
              <span className="text-sm text-[#667781] dark:text-[#8696a0]">Sem mensagens</span>
            )}
            {isUnread ? (
              <span className="h-2.5 min-w-2.5 shrink-0 rounded-full bg-[#25d366]" aria-label="Não lida" />
            ) : (
              <Check className="h-4 w-4 shrink-0 text-[#8696a0] opacity-70" aria-hidden />
            )}
          </span>
        </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={onSelect}
          disabled={deleting}
          className="flex w-full items-center gap-3 px-3 py-3 pr-10 text-left disabled:opacity-60"
        >
          <WaAvatar label={label} isGroup={isGroup} />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-2">
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-[17px] text-[#111b21] dark:text-[#e9edef]',
                  isUnread ? 'font-semibold' : 'font-normal',
                )}
              >
                {label}
              </span>
              {timeLabel ? (
                <span
                  className={cn(
                    'shrink-0 text-xs tabular-nums',
                    isUnread
                      ? 'font-medium text-[#25d366]'
                      : 'text-[#667781] dark:text-[#8696a0]',
                  )}
                >
                  {timeLabel}
                </span>
              ) : null}
            </span>
            <WaJidHint waFrom={conv.wa_from} />
            <span className="mt-0.5 flex items-center gap-1.5">
              {conv.last_preview ? (
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-sm',
                    isUnread
                      ? 'font-medium text-[#111b21] dark:text-[#e9edef]'
                      : 'font-normal text-[#667781] dark:text-[#8696a0]',
                  )}
                >
                  {conv.last_preview}
                </span>
              ) : (
                <span className="text-sm text-[#667781] dark:text-[#8696a0]">Sem mensagens</span>
              )}
              {isUnread ? (
                <span className="h-2.5 min-w-2.5 shrink-0 rounded-full bg-[#25d366]" aria-label="Não lida" />
              ) : (
                <Check className="h-4 w-4 shrink-0 text-[#8696a0] opacity-70" aria-hidden />
              )}
            </span>
          </span>
        </button>
      )}
      {!selectionMode ? (
      <div
        className={cn(
          'absolute right-1 top-2 transition-opacity',
          deleting ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
        )}
      >
        {deleting ? (
          <span className="flex h-7 w-7 items-center justify-center">
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
              {isUnread ? (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    onMarkRead()
                  }}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Marcar como lida
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onArchive()
                }}
              >
                <Archive className="mr-2 h-4 w-4" />
                Arquivar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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
      ) : null}
    </div>
  )
}

export function WhatsappInboxClient () {
  const router = useRouter()
  const [channelsLoading, setChannelsLoading] = useState(true)
  const [channelMetas, setChannelMetas] = useState<ChannelMeta[]>([])
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conv[]>([])
  const [convLoading, setConvLoading] = useState(false)
  const [convLoadingMore, setConvLoadingMore] = useState(false)
  const [convHasMore, setConvHasMore] = useState(false)
  const [convCursor, setConvCursor] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [msgLoading, setMsgLoading] = useState(false)
  const [msgLoadingMore, setMsgLoadingMore] = useState(false)
  const [msgHasMore, setMsgHasMore] = useState(false)
  const [msgBefore, setMsgBefore] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const sendInFlightRef = useRef(false)
  const [creatingOrder, setCreatingOrder] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeListTab, setActiveListTab] = useState<ListTab>('contacts')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [archivingId, setArchivingId] = useState<string | null>(null)
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null)
  const [messageSelectMode, setMessageSelectMode] = useState(false)
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(() => new Set())
  const [bulkDeletingMessages, setBulkDeletingMessages] = useState(false)
  const [convSelectMode, setConvSelectMode] = useState(false)
  const [selectedConvIds, setSelectedConvIds] = useState<Set<string>>(() => new Set())
  const [bulkDeletingConvs, setBulkDeletingConvs] = useState(false)

  const composerRef = useRef<WhatsappChatComposerHandle>(null)
  const messagesScrollRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const convListEndRef = useRef<HTMLDivElement>(null)
  const convLoadingMoreRef = useRef(false)
  const msgLoadingMoreRef = useRef(false)
  const shouldScrollMessagesBottomRef = useRef(false)
  const convCursorRef = useRef<string | null>(null)

  convCursorRef.current = convCursor

  useEffect(() => {
    setMessageSelectMode(false)
    setSelectedMessageIds(new Set())
  }, [selectedId])

  useEffect(() => {
    setConvSelectMode(false)
    setSelectedConvIds(new Set())
  }, [activeChannelId, activeListTab, searchQuery])

  const exitMessageSelectMode = useCallback(() => {
    setMessageSelectMode(false)
    setSelectedMessageIds(new Set())
  }, [])

  const exitConvSelectMode = useCallback(() => {
    setConvSelectMode(false)
    setSelectedConvIds(new Set())
  }, [])

  const enterConvSelectMode = useCallback(() => {
    exitMessageSelectMode()
    setConvSelectMode(true)
    setSelectedConvIds(new Set())
  }, [exitMessageSelectMode])

  const toggleConvSelect = useCallback((convId: string) => {
    setSelectedConvIds((prev) => {
      const next = new Set(prev)
      if (next.has(convId)) next.delete(convId)
      else next.add(convId)
      return next
    })
  }, [])

  const toggleMessageSelect = useCallback((messageId: string) => {
    setSelectedMessageIds((prev) => {
      const next = new Set(prev)
      if (next.has(messageId)) next.delete(messageId)
      else next.add(messageId)
      return next
    })
  }, [])

  const selectAllLoadedMessages = useCallback(() => {
    setSelectedMessageIds(new Set(messages.map((m) => m.id)))
  }, [messages])

  const loadChannels = useCallback(async () => {
    const res = await fetch('/api/portal/whatsapp/conversations?scope=channels')
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok) {
      toast({ title: 'Erro ao carregar canais', variant: 'destructive' })
      return []
    }
    const list = (data.channels || []) as ChannelMeta[]
    setChannelMetas(list)
    return list
  }, [])

  const fetchConversationsPage = useCallback(
    async (opts: { reset: boolean; cursor: string | null }) => {
      if (!activeChannelId) return
      const params = new URLSearchParams({
        channel_id: activeChannelId,
        kind: activeListTab,
        limit: String(PAGE_SIZE),
      })
      if (opts.cursor) params.set('cursor', opts.cursor)
      if (searchQuery.trim()) params.set('q', searchQuery.trim())

      const res = await fetch(`/api/portal/whatsapp/conversations?${params}`)
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast({ title: 'Erro ao carregar conversas', variant: 'destructive' })
        return
      }

      const page = (data.conversations || []) as Conv[]
      setConvHasMore(Boolean(data.has_more))
      setConvCursor(data.next_cursor ? String(data.next_cursor) : null)

      if (opts.reset) {
        setConversations(page)
        setSelectedId((prev) => {
          if (prev && page.some((c) => c.id === prev)) return prev
          return page[0]?.id ?? null
        })
      } else {
        setConversations((prev) => {
          const seen = new Set(prev.map((c) => c.id))
          const merged = [...prev]
          for (const c of page) {
            if (!seen.has(c.id)) merged.push(c)
          }
          return merged
        })
      }
    },
    [activeChannelId, activeListTab, searchQuery],
  )

  const loadConversations = useCallback(
    async (reset: boolean, opts?: { silent?: boolean }) => {
      if (!activeChannelId) return
      const silent = opts?.silent === true
      if (reset && !silent) setConvLoading(true)
      else if (!reset) setConvLoadingMore(true)
      try {
        await fetchConversationsPage({
          reset,
          cursor: reset ? null : convCursorRef.current,
        })
      } finally {
        if (reset && !silent) setConvLoading(false)
        else if (!reset) setConvLoadingMore(false)
      }
    },
    [activeChannelId, fetchConversationsPage],
  )

  const hydrateMessageMedia = useCallback(
    async (conversationId: string, list: Msg[]) => {
      const ids = list
        .filter((m) => {
          const media = (m.payload as { media?: { storage_path?: string } } | undefined)?.media
          return Boolean(media?.storage_path) && !m.media_url
        })
        .map((m) => m.id)
      if (ids.length === 0) return

      const res = await fetch(
        `/api/portal/whatsapp/conversations/${conversationId}/messages/media-urls`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageIds: ids }),
        },
      )
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok || !data.urls) return

      const urls = data.urls as Record<string, { media_url: string | null; media_expired: boolean }>
      setMessages((prev) =>
        prev.map((m) => {
          const u = urls[m.id]
          if (!u) return m
          return { ...m, media_url: u.media_url, media_expired: u.media_expired }
        }),
      )
    },
    [],
  )

  const fetchMessagesPage = useCallback(
    async (conversationId: string, opts: { reset: boolean; before: string | null }) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), media: '0' })
      if (opts.before) params.set('before', opts.before)

      const res = await fetch(
        `/api/portal/whatsapp/conversations/${conversationId}/messages?${params}`,
      )
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) return

      const list = (data.messages || []) as Msg[]
      setMsgHasMore(Boolean(data.has_more))
      setMsgBefore(data.next_before ? String(data.next_before) : null)

      if (opts.reset) {
        setMessages(list)
        void hydrateMessageMedia(conversationId, list)
      } else {
        setMsgLoadingMore(true)
        const scrollEl = messagesScrollRef.current
        const prevHeight = scrollEl?.scrollHeight ?? 0
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id))
          const older = list.filter((m) => !seen.has(m.id))
          return [...older, ...prev]
        })
        void hydrateMessageMedia(conversationId, list)
        requestAnimationFrame(() => {
          if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight - prevHeight
          setMsgLoadingMore(false)
        })
      }
    },
    [hydrateMessageMedia],
  )

  useEffect(() => {
    void (async () => {
      setChannelsLoading(true)
      const ch = await loadChannels()
      setChannelsLoading(false)
      if (ch.length > 0) setActiveChannelId((prev) => prev ?? ch[0].channel_id)
    })()
  }, [loadChannels])

  useEffect(() => {
    if (!activeChannelId) {
      setConversations([])
      setSelectedId(null)
      return
    }
    setSearchInput('')
    setSearchQuery('')
    setActiveListTab('contacts')
  }, [activeChannelId])

  useEffect(() => {
    if (!activeChannelId) return
    void loadConversations(true)
  }, [activeChannelId, activeListTab, searchQuery, loadConversations])

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchInput])

  useWhatsappInboxRealtime({
    selectedId,
    setConversations,
    setMessages,
    onListRefresh: (opts) => {
      void loadConversations(true, opts)
    },
  })

  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      setMsgHasMore(false)
      setMsgBefore(null)
      return
    }
    let cancelled = false
    shouldScrollMessagesBottomRef.current = true
    void (async () => {
      setMsgLoading(true)
      await fetchMessagesPage(selectedId, { reset: true, before: null })
      if (!cancelled) setMsgLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [selectedId, fetchMessagesPage])

  useEffect(() => {
    if (msgLoading || !selectedId || !shouldScrollMessagesBottomRef.current) return
    shouldScrollMessagesBottomRef.current = false
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [messages, msgLoading, selectedId])

  useEffect(() => {
    const el = convListEndRef.current
    if (!el || !convHasMore) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || convLoadingMoreRef.current || convLoading) return
        convLoadingMoreRef.current = true
        void loadConversations(false).finally(() => {
          convLoadingMoreRef.current = false
        })
      },
      { rootMargin: '120px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [convHasMore, convLoading, loadConversations, conversations.length])

  useEffect(() => {
    const el = messagesScrollRef.current
    if (!el || !msgHasMore || !selectedId || !msgBefore) return
    const onScroll = () => {
      if (el.scrollTop > 80 || msgLoadingMoreRef.current || msgLoading) return
      msgLoadingMoreRef.current = true
      void fetchMessagesPage(selectedId, { reset: false, before: msgBefore }).finally(() => {
        msgLoadingMoreRef.current = false
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [msgHasMore, msgBefore, msgLoading, selectedId, fetchMessagesPage])

  const patchConversationAttention = useCallback((convId: string, needs: boolean) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, needs_staff_attention: needs } : c)),
    )
  }, [])

  async function handleMarkRead (id: string) {
    const res = await fetch(`/api/portal/whatsapp/conversations/${id}/mark-attended`, {
      method: 'POST',
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok) {
      toast({ title: 'Erro ao marcar como lida', variant: 'destructive' })
      return
    }
    patchConversationAttention(id, false)
  }

  async function handleMarkAttended () {
    if (!selectedId) return
    await handleMarkRead(selectedId)
    toast({ variant: 'success', title: 'Marcado como lida' })
  }

  async function handleArchiveConversation (id: string) {
    const conv = conversations.find((c) => c.id === id)
    const label = conv ? formatWaConversationLabel(conv.wa_from, conv.state) : 'esta conversa'
    if (!confirm(`Arquivar "${label}"?\n\nRemove do portal e arquiva no WhatsApp.`)) return

    setArchivingId(id)
    try {
      const res = await fetch(`/api/portal/whatsapp/conversations/${id}/archive`, { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast({ title: 'Não foi possível arquivar', variant: 'destructive' })
        return
      }
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (selectedId === id) {
        const rest = conversations.filter((c) => c.id !== id)
        setSelectedId(rest[0]?.id ?? null)
        if (!rest[0]) setMessages([])
      }
      toast({ variant: 'success', title: 'Conversa arquivada' })
    } finally {
      setArchivingId(null)
    }
  }

  async function handleDeleteConversation (id: string) {
    const conv = conversations.find((c) => c.id === id)
    const label = conv ? formatWaConversationLabel(conv.wa_from, conv.state) : 'esta conversa'
    if (
      !confirm(
        `Remover "${label}" do portal?\n\nAs mensagens salvas aqui também serão apagadas.`,
      )
    ) {
      return
    }

    setDeletingId(id)
    try {
      const res = await fetch(`/api/portal/whatsapp/conversations/${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast({ title: 'Não foi possível excluir', variant: 'destructive' })
        return
      }
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (selectedId === id) {
        const rest = conversations.filter((c) => c.id !== id)
        setSelectedId(rest[0]?.id ?? null)
        if (!rest[0]) setMessages([])
      }
      toast({ variant: 'success', title: 'Conversa removida do portal' })
    } finally {
      setDeletingId(null)
    }
  }

  async function handleReopen () {
    if (!selectedId) return
    const res = await fetch(`/api/portal/whatsapp/conversations/${selectedId}/reopen`, {
      method: 'POST',
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok) {
      toast({ title: 'Erro ao reabrir', variant: 'destructive' })
      return
    }
    patchConversationAttention(selectedId, true)
  }

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      if (!selectedId) return
      if (!confirm('Remover esta mensagem do Conectize?')) return
      setDeletingMessageId(messageId)
      try {
        const res = await fetch(
          `/api/portal/whatsapp/conversations/${selectedId}/messages/${messageId}`,
          { method: 'DELETE' },
        )
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok) {
          toast({ title: 'Não foi possível excluir a mensagem', variant: 'destructive' })
          return
        }
        setMessages((prev) => prev.filter((m) => m.id !== messageId))
      } finally {
        setDeletingMessageId(null)
      }
    },
    [selectedId],
  )

  const handleBulkDeleteMessages = useCallback(async () => {
    if (!selectedId || selectedMessageIds.size === 0) return
    const ids = [...selectedMessageIds]
    if (
      !confirm(
        `Remover ${ids.length} mensagem(ns) do Conectize?\n\nNão apaga no WhatsApp do cliente.`,
      )
    ) {
      return
    }
    setBulkDeletingMessages(true)
    try {
      const res = await fetch(
        `/api/portal/whatsapp/conversations/${selectedId}/messages/bulk-delete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message_ids: ids }),
        },
      )
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast({ title: 'Não foi possível excluir as mensagens', variant: 'destructive' })
        return
      }
      const deleted = Number(data.deleted) || ids.length
      setMessages((prev) => prev.filter((m) => !selectedMessageIds.has(m.id)))
      exitMessageSelectMode()
      toast({
        variant: 'success',
        title: deleted === 1 ? '1 mensagem removida' : `${deleted} mensagens removidas`,
      })
    } finally {
      setBulkDeletingMessages(false)
    }
  }, [selectedId, selectedMessageIds, exitMessageSelectMode])

  async function handleSend () {
    if (!selectedId || !reply.trim() || sendInFlightRef.current) return
    const sentText = reply.trim()
    const convId = selectedId
    const now = new Date().toISOString()
    const optimisticId = `optimistic-${Date.now()}`

    sendInFlightRef.current = true
    setReply('')
    shouldScrollMessagesBottomRef.current = true

    setConversations((prev) =>
      patchConversationAfterOutboundMessage(prev, convId, sentText, now),
    )

    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        direction: 'out',
        body: sentText,
        status: 'attended',
        resolved_by: 'human',
        needs_human: false,
        created_at: now,
        deleted_at: null,
        payload: { source: 'staff', delivery_status: 'sending' },
      },
    ])

    requestAnimationFrame(() => {
      composerRef.current?.focus()
    })

    try {
      const res = await fetch(`/api/portal/whatsapp/conversations/${convId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sentText }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
        setReply(sentText)
        toast({
          title: 'Erro ao enviar',
          description: String((data as { hint?: string })?.hint || data?.error || ''),
          variant: 'destructive',
        })
        requestAnimationFrame(() => {
          composerRef.current?.focus()
        })
        return
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimisticId
            ? {
                ...m,
                payload: {
                  ...(m.payload || {}),
                  source: 'staff',
                  delivery_status: 'sent',
                },
              }
            : m,
        ),
      )
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
      setReply(sentText)
      toast({
        title: 'Erro ao enviar',
        description: 'Falha de rede. Tente novamente.',
        variant: 'destructive',
      })
      requestAnimationFrame(() => {
        composerRef.current?.focus()
      })
    } finally {
      sendInFlightRef.current = false
    }
  }

  async function handleCreateOrder () {
    if (!selectedId) return
    setCreatingOrder(true)
    try {
      const result = await createOrderFromWhatsappConversationAction(selectedId)
      if (result.ok === false) {
        toast({ title: 'Não foi possível criar a OS', description: result.error, variant: 'destructive' })
        return
      }
      router.push(result.redirectTo)
    } finally {
      setCreatingOrder(false)
    }
  }

  const selected = conversations.find((c) => c.id === selectedId)
  const selectedLabel = selected ? formatWaConversationLabel(selected.wa_from, selected.state) : ''
  const draft = selected?.draft_os || null
  const hasMultipleChannels = channelMetas.length > 1

  const tabConversations = useMemo(
    () =>
      activeListTab === 'contacts'
        ? conversations.filter((c) => !isGroupConversation(c))
        : conversations.filter((c) => isGroupConversation(c)),
    [activeListTab, conversations],
  )

  const selectAllLoadedConvs = useCallback(() => {
    setSelectedConvIds(new Set(tabConversations.map((c) => c.id)))
  }, [tabConversations])

  const handleBulkDeleteConversations = useCallback(async () => {
    if (selectedConvIds.size === 0) return
    const ids = [...selectedConvIds]
    const noun = activeListTab === 'contacts' ? 'contato(s)' : 'grupo(s)'
    if (
      !confirm(
        `Remover ${ids.length} ${noun} do Conectize?\n\nTodas as mensagens salvas dessas conversas também serão apagadas.`,
      )
    ) {
      return
    }
    setBulkDeletingConvs(true)
    try {
      const res = await fetch('/api/portal/whatsapp/conversations/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_ids: ids }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast({ title: 'Não foi possível excluir', variant: 'destructive' })
        return
      }
      const deleted = Number(data.deleted) || ids.length
      const removed = selectedConvIds
      setConversations((prev) => {
        const next = prev.filter((c) => !removed.has(c.id))
        if (selectedId && removed.has(selectedId)) {
          setSelectedId(next[0]?.id ?? null)
          if (!next[0]) setMessages([])
        }
        return next
      })
      exitConvSelectMode()
      toast({
        variant: 'success',
        title: deleted === 1 ? '1 conversa removida' : `${deleted} conversas removidas`,
      })
    } finally {
      setBulkDeletingConvs(false)
    }
  }, [selectedConvIds, activeListTab, selectedId, exitConvSelectMode])

  const selectedConvCount = selectedConvIds.size
  const allTabConvsSelected =
    tabConversations.length > 0 &&
    tabConversations.every((c) => selectedConvIds.has(c.id))

  const selectedCount = selectedMessageIds.size
  const allLoadedSelected =
    messages.length > 0 && messages.every((m) => selectedMessageIds.has(m.id))

  const messageNodes = useMemo(() => {
    let lastDay = ''
    const nodes: ReactNode[] = []
    if (msgLoadingMore) {
      nodes.push(
        <div key="msg-more" className="flex justify-center py-2">
          <Loader2 className="h-5 w-5 animate-spin text-[#54656f]" />
        </div>,
      )
    }
    for (const m of messages) {
      const day = waDayKey(m.created_at)
      if (day && day !== lastDay) {
        lastDay = day
        nodes.push(
          <div key={`day-${day}-${m.id}`} className="my-3 flex justify-center">
            <span className="rounded-lg bg-white/90 px-3 py-1 text-xs font-medium text-[#54656f] shadow-sm dark:bg-[#182229] dark:text-[#8696a0]">
              {formatWaDayDivider(m.created_at)}
            </span>
          </div>,
        )
      }
      const fromAi = m.direction === 'out' && m.payload?.source === 'ai'
      const fromPhone = m.direction === 'out' && m.payload?.source === 'whatsapp_device'
      nodes.push(
        <WhatsappMessageBubble
          key={m.id}
          direction={m.direction}
          body={m.body}
          payload={m.payload}
          mediaUrl={m.media_url ?? null}
          mediaExpired={Boolean(m.media_expired)}
          createdAt={m.created_at}
          isDeleted={Boolean(m.deleted_at)}
          fromAi={Boolean(fromAi)}
          fromPhone={Boolean(fromPhone)}
          needsReview={Boolean(m.needs_human && m.status === 'pending' && !m.deleted_at)}
          selectionMode={messageSelectMode}
          selected={selectedMessageIds.has(m.id)}
          onToggleSelect={() => toggleMessageSelect(m.id)}
          deleting={deletingMessageId === m.id}
          onDelete={
            messageSelectMode ? undefined : () => void handleDeleteMessage(m.id)
          }
        />,
      )
    }
    return nodes
  }, [
    messages,
    deletingMessageId,
    handleDeleteMessage,
    msgLoadingMore,
    messageSelectMode,
    selectedMessageIds,
    toggleMessageSelect,
  ])

  return (
    <div className="flex min-h-[min(720px,calc(100vh-10rem))] flex-1 flex-col">
      <div className="grid min-h-0 flex-1 overflow-hidden rounded-lg border border-[#d1d7db] dark:border-[#2a3942] lg:grid-cols-[minmax(280px,360px)_1fr]">
        <div className="flex max-h-[min(720px,calc(100vh-10rem))] flex-col overflow-hidden border-r border-[#d1d7db] bg-white dark:border-[#2a3942] dark:bg-[#111b21]">
          <div className="space-y-2 border-b border-[#d1d7db] bg-[#f0f2f5] px-3 py-3 dark:border-[#2a3942] dark:bg-[#202c33]">
            {hasMultipleChannels ? (
              <div className="flex gap-1 overflow-x-auto rounded-lg bg-[#e9edef]/80 p-0.5 dark:bg-[#111b21]/60">
                {channelMetas.map((ch) => (
                  <button
                    key={ch.channel_id}
                    type="button"
                    onClick={() => setActiveChannelId(ch.channel_id)}
                    className={cn(
                      'shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                      activeChannelId === ch.channel_id
                        ? 'bg-white text-[#111b21] shadow-sm dark:bg-[#2a3942] dark:text-[#e9edef]'
                        : 'text-[#54656f] hover:text-[#111b21] dark:text-[#8696a0]',
                    )}
                  >
                    {ch.label}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#54656f]" />
              <Input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Pesquisar conversa"
                className="h-9 rounded-lg border-0 bg-white pl-9 text-sm shadow-sm dark:bg-[#2a3942] dark:text-[#e9edef]"
              />
            </div>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted/60 p-0.5">
              <button
                type="button"
                onClick={() => setActiveListTab('contacts')}
                disabled={convSelectMode}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium',
                  activeListTab === 'contacts' ? 'bg-background shadow-sm' : 'text-muted-foreground',
                  convSelectMode && 'opacity-50',
                )}
              >
                <UserRound className="h-3.5 w-3.5" />
                Contatos
              </button>
              <button
                type="button"
                onClick={() => setActiveListTab('groups')}
                disabled={convSelectMode}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium',
                  activeListTab === 'groups' ? 'bg-background shadow-sm' : 'text-muted-foreground',
                  convSelectMode && 'opacity-50',
                )}
              >
                <Users className="h-3.5 w-3.5" />
                Grupos
              </button>
            </div>
            {convSelectMode ? (
              <div className="flex items-center gap-2 rounded-lg border border-[#d1d7db] bg-white px-2 py-2 dark:border-[#2a3942] dark:bg-[#111b21]">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  aria-label="Cancelar seleção"
                  onClick={exitConvSelectMode}
                >
                  <X className="h-4 w-4" />
                </Button>
                <p className="min-w-0 flex-1 text-xs font-medium text-[#111b21] dark:text-[#e9edef]">
                  {selectedConvCount === 0
                    ? 'Selecione conversas'
                    : `${selectedConvCount} selecionada${selectedConvCount === 1 ? '' : 's'}`}
                </p>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-8 shrink-0 text-xs"
                  disabled={selectedConvCount === 0 || bulkDeletingConvs}
                  onClick={() => void handleBulkDeleteConversations()}
                >
                  {bulkDeletingConvs ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            ) : tabConversations.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-full text-xs"
                onClick={enterConvSelectMode}
              >
                <CheckSquare className="mr-2 h-3.5 w-3.5" />
                {activeListTab === 'contacts' ? 'Selecionar contatos' : 'Selecionar grupos'}
              </Button>
            ) : null}
            {convSelectMode && tabConversations.length > 0 ? (
              <label className="flex cursor-pointer items-center gap-2 text-xs text-[#111b21] dark:text-[#e9edef]">
                <Checkbox
                  checked={
                    allTabConvsSelected
                      ? true
                      : selectedConvCount > 0
                        ? 'indeterminate'
                        : false
                  }
                  onCheckedChange={(checked) => {
                    if (checked === true) selectAllLoadedConvs()
                    else setSelectedConvIds(new Set())
                  }}
                  aria-label="Selecionar todas as conversas visíveis"
                />
                <span>
                  Todas nesta lista ({tabConversations.length})
                </span>
              </label>
            ) : null}
          </div>
          <div className="flex-1 overflow-y-auto">
            {channelsLoading || convLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : tabConversations.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                {searchQuery.trim() ? `Nenhum resultado para "${searchQuery.trim()}".` : 'Nenhuma conversa.'}
              </p>
            ) : (
              <>
                {tabConversations.map((c) => (
                  <ConversationRow
                    key={c.id}
                    conv={c}
                    selected={selectedId === c.id}
                    selectionMode={convSelectMode}
                    checked={selectedConvIds.has(c.id)}
                    onToggleCheck={() => toggleConvSelect(c.id)}
                    deleting={
                      deletingId === c.id ||
                      archivingId === c.id ||
                      (bulkDeletingConvs && selectedConvIds.has(c.id))
                    }
                    onSelect={() => {
                      if (!convSelectMode) setSelectedId(c.id)
                    }}
                    onMarkRead={() => void handleMarkRead(c.id)}
                    onArchive={() => void handleArchiveConversation(c.id)}
                    onDelete={() => void handleDeleteConversation(c.id)}
                  />
                ))}
                {convLoadingMore ? (
                  <div className="flex justify-center py-3">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : null}
                <div ref={convListEndRef} className="h-1" aria-hidden />
              </>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-col bg-[#efeae2] dark:bg-[#0b141a]">
          {!selectedId ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-[#f0f2f5] px-6 text-center dark:bg-[#222e35]">
              <span className="text-6xl opacity-30" aria-hidden>💬</span>
              <p className="text-lg text-[#41525d] dark:text-[#8696a0]">Conectize WhatsApp</p>
              <p className="max-w-sm text-sm text-[#667781]">Selecione uma conversa à esquerda.</p>
            </div>
          ) : (
            <>
              <div className="flex shrink-0 items-center gap-3 border-b border-[#d1d7db] bg-[#f0f2f5] px-3 py-2 dark:border-[#2a3942] dark:bg-[#202c33]">
                {messageSelectMode ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      aria-label="Cancelar seleção"
                      onClick={exitMessageSelectMode}
                    >
                      <X className="h-5 w-5" />
                    </Button>
                    <p className="min-w-0 flex-1 text-sm font-medium text-[#111b21] dark:text-[#e9edef]">
                      {selectedCount === 0
                        ? 'Selecione mensagens'
                        : `${selectedCount} selecionada${selectedCount === 1 ? '' : 's'}`}
                    </p>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={selectedCount === 0 || bulkDeletingMessages}
                      onClick={() => void handleBulkDeleteMessages()}
                    >
                      {bulkDeletingMessages ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
                      )}
                      Excluir
                    </Button>
                  </>
                ) : (
                  <>
                <WaAvatar
                  label={selectedLabel}
                  isGroup={selected ? isGroupConversation(selected) : false}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium text-[#111b21] dark:text-[#e9edef]">
                    {selectedLabel}
                  </p>
                  {selected ? <WaJidHint waFrom={selected.wa_from} /> : null}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label="Menu">
                      <MoreHorizontal className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem
                      onClick={() => {
                        exitConvSelectMode()
                        setMessageSelectMode(true)
                        setSelectedMessageIds(new Set())
                      }}
                    >
                      <CheckSquare className="mr-2 h-4 w-4" />
                      Selecionar mensagens
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {selected?.needs_staff_attention ? (
                      <DropdownMenuItem onClick={() => void handleMarkAttended()}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Marcar como lida
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem onClick={() => void handleReopen()}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Marcar como pendente
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => selectedId && void handleArchiveConversation(selectedId)}>
                      <Archive className="mr-2 h-4 w-4" />
                      Arquivar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={creatingOrder || !!selected?.service_order_id}
                      onClick={() => void handleCreateOrder()}
                    >
                      Criar OS a partir do chat
                    </DropdownMenuItem>
                    {selected?.service_order_id && selected.service_orders?.display_number != null ? (
                      <DropdownMenuItem asChild>
                        <Link href={`/portal/ordens/${selected.service_orders.display_number}`}>
                          Ver OS vinculada
                        </Link>
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => selectedId && void handleDeleteConversation(selectedId)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir do portal
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                  </>
                )}
              </div>

              {messageSelectMode && messages.length > 0 ? (
                <div className="flex shrink-0 items-center gap-3 border-b border-[#d1d7db] bg-[#f0f2f5] px-3 py-2 text-sm dark:border-[#2a3942] dark:bg-[#202c33]">
                  <label className="flex cursor-pointer items-center gap-2 text-[#111b21] dark:text-[#e9edef]">
                    <Checkbox
                      checked={
                        allLoadedSelected
                          ? true
                          : selectedCount > 0
                            ? 'indeterminate'
                            : false
                      }
                      onCheckedChange={(checked) => {
                        if (checked === true) selectAllLoadedMessages()
                        else setSelectedMessageIds(new Set())
                      }}
                      aria-label="Selecionar todas as mensagens carregadas"
                    />
                    <span>Todas nesta tela ({messages.length})</span>
                  </label>
                  <span className="text-xs text-[#667781] dark:text-[#8696a0]">
                    Só mensagens já carregadas; role para cima para incluir mais antigas.
                  </span>
                </div>
              ) : null}

              {draft && Object.keys(draft).length > 0 ? (
                <div className="shrink-0 border-b border-[#d1d7db] bg-[#fff8e6] px-3 py-2 text-xs dark:border-[#2a3942] dark:bg-[#3b2f1a]">
                  <span className="font-medium">Rascunho (IA): </span>
                  {JSON.stringify(draft)}
                </div>
              ) : null}

              <div
                ref={messagesScrollRef}
                className="flex-1 space-y-1 overflow-y-auto px-[4%] py-3"
                style={{
                  backgroundColor: '#efeae2',
                  backgroundImage:
                    'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23d4cfc4\' fill-opacity=\'0.35\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
                }}
              >
                {msgLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-[#54656f]" />
                  </div>
                ) : messageNodes.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[#667781]">Nenhuma mensagem.</p>
                ) : (
                  messageNodes
                )}
                <div ref={messagesEndRef} aria-hidden className="h-0 w-full shrink-0" />
              </div>

              {messageSelectMode ? (
                <div className="shrink-0 border-t border-[#d1d7db] bg-[#f0f2f5] px-4 py-3 text-center text-sm text-[#667781] dark:border-[#2a3942] dark:bg-[#202c33] dark:text-[#8696a0]">
                  Modo seleção — use Excluir no topo ou cancele com ✕
                </div>
              ) : (
              <WhatsappChatComposer
                ref={composerRef}
                key={selectedId}
                value={reply}
                onChange={setReply}
                onSend={handleSend}
                autoFocus
              />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
