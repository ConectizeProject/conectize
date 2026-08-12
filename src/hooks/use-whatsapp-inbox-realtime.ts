'use client'

import { useEffect, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import {
  applyConversationUpdateToList,
  applyMessageInsertToConversationList,
  applyMessageInsertToMessages,
  applyMessageUpdateToMessages,
  parseRealtimePayload,
  type InboxConv,
  type InboxMsg,
  type RealtimeConversationRow,
  type RealtimeMessageRow,
} from '@/lib/whatsapp/whatsapp-inbox-realtime'

const LIST_REFRESH_DEBOUNCE_MS = 800

export function useWhatsappInboxRealtime (opts: {
  selectedId: string | null
  setConversations: React.Dispatch<React.SetStateAction<InboxConv[]>>
  setMessages: React.Dispatch<React.SetStateAction<InboxMsg[]>>
  /** Refetch da lista sem spinner (ex.: conversa nova fora da página carregada). */
  onListRefresh: (opts?: { silent?: boolean }) => void | Promise<void>
}) {
  const { selectedId, setConversations, setMessages, onListRefresh } = opts
  const selectedIdRef = useRef(selectedId)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onListRefreshRef = useRef(onListRefresh)

  selectedIdRef.current = selectedId
  onListRefreshRef.current = onListRefresh

  const scheduleListRefresh = () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null
      void onListRefreshRef.current({ silent: true })
    }, LIST_REFRESH_DEBOUNCE_MS)
  }

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    let channel: RealtimeChannel | null = null

    const subscribe = () => {
      channel = supabase
        .channel('portal-whatsapp-inbox')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' },
          (payload) => {
            const row = parseRealtimePayload<RealtimeMessageRow>(payload.new)
            if (!row?.id || !row.conversation_id) return

            setConversations((prev) => {
              const { conversations, found } = applyMessageInsertToConversationList(prev, row)
              if (!found) scheduleListRefresh()
              return conversations
            })

            setMessages((prev) =>
              applyMessageInsertToMessages(prev, row, selectedIdRef.current),
            )
          },
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'whatsapp_messages' },
          (payload) => {
            const row = parseRealtimePayload<RealtimeMessageRow>(payload.new)
            if (!row?.id) return
            setMessages((prev) => applyMessageUpdateToMessages(prev, row))
          },
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'whatsapp_conversations' },
          () => {
            scheduleListRefresh()
          },
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'whatsapp_conversations' },
          (payload) => {
            const row = parseRealtimePayload<RealtimeConversationRow>(payload.new)
            if (!row?.id) return
            setConversations((prev) => {
              const next = applyConversationUpdateToList(prev, row)
              if (next === prev) scheduleListRefresh()
              return next
            })
          },
        )
        .subscribe((status, err) => {
          if (status === 'CHANNEL_ERROR') {
            console.warn('[whatsapp-inbox] realtime channel error', err)
          }
        })
    }

    subscribe()

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
      if (channel) void supabase.removeChannel(channel)
    }
  }, [setConversations, setMessages])
}
