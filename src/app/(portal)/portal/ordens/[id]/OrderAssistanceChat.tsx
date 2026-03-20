'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { formatDateTimeBr } from '@/lib/utils/format-date'
import { portalFetch } from '@/lib/portal/portal-fetch'

type AssistanceComment = {
  id: string
  content: string
  created_at: string
  author_display_name: string
  author_user_id: string | null
}

type Props = {
  orderId: string
  legacyAssistanceInfo?: string | null
  legacyUpdatedAt?: string | null
  disabled?: boolean
}

export function OrderAssistanceChat({ orderId, legacyAssistanceInfo, legacyUpdatedAt, disabled = false }: Props) {
  const [comments, setComments] = useState<AssistanceComment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [actorUserId, setActorUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  const [draft, setDraft] = useState('')
  const [isPosting, setIsPosting] = useState(false)

  const legacyText = useMemo(() => String(legacyAssistanceInfo || '').trim(), [legacyAssistanceInfo])
  const legacyUpdatedAtText = useMemo(() => String(legacyUpdatedAt || '').trim(), [legacyUpdatedAt])

  const messages = useMemo(() => {
    if (!legacyText) return comments
    return [
      {
        id: 'legacy',
        content: legacyText,
        created_at: legacyUpdatedAtText || '',
        author_display_name: 'Histórico',
        author_user_id: null,
      },
      ...comments,
    ]
  }, [comments, legacyText, legacyUpdatedAtText])

  const fetchComments = useCallback(async () => {
    setIsLoading(true)
    setFetchError(null)

    const res = await portalFetch(`/api/portal/ordens/${orderId}/assistance-comments`)
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok || !Array.isArray(data?.comments)) {
      setFetchError(data?.error ? String(data.error) : 'Não foi possível carregar o histórico da assistência.')
      setComments([])
      setIsLoading(false)
      return
    }

    setActorUserId(typeof data?.actorUserId === 'string' ? data.actorUserId : null)
    setIsAdmin(Boolean(data?.isAdmin))

    setComments(data.comments as AssistanceComment[])
    setIsLoading(false)
  }, [orderId])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  const sendComment = useCallback(async () => {
    if (disabled) return
    if (isPosting) return

    const content = draft.trim()
    if (!content) return
    if (content.length > 6000) return

    setIsPosting(true)
    try {
      const res = await portalFetch(`/api/portal/ordens/${orderId}/assistance-comments`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ content }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setFetchError(data?.error ? String(data.error) : 'Não foi possível salvar o comentário.')
        return
      }

      setDraft('')
      await fetchComments()
    } finally {
      setIsPosting(false)
    }
  }, [draft, disabled, fetchComments, isPosting, orderId])

  const canManageComment = useCallback((c: AssistanceComment) => {
    if (disabled) return false
    return Boolean(isAdmin || (actorUserId && c.author_user_id === actorUserId))
  }, [actorUserId, disabled, isAdmin])

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState('')
  const [isEditingSaving, setIsEditingSaving] = useState(false)

  const startEdit = useCallback((commentId: string, currentContent: string) => {
    if (disabled) return
    setEditingCommentId(commentId)
    setEditingDraft(currentContent)
  }, [disabled])

  const cancelEdit = useCallback(() => {
    setEditingCommentId(null)
    setEditingDraft('')
  }, [])

  const saveEdit = useCallback(async (commentId: string) => {
    if (disabled) return
    if (isEditingSaving) return

    const content = editingDraft.trim()
    if (!content) return

    setIsEditingSaving(true)
    try {
      const res = await portalFetch(`/api/portal/ordens/${orderId}/assistance-comments/${commentId}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ content }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setFetchError(data?.error ? String(data.error) : 'Não foi possível salvar a edição.')
        return
      }

      cancelEdit()
      await fetchComments()
    } finally {
      setIsEditingSaving(false)
    }
  }, [cancelEdit, editingDraft, fetchComments, isEditingSaving, orderId, disabled])

  const deleteComment = useCallback(async (commentId: string) => {
    if (disabled) return

    const ok = window.confirm('Excluir este comentário da assistência?')
    if (!ok) return

    const res = await portalFetch(`/api/portal/ordens/${orderId}/assistance-comments/${commentId}`, {
      method: 'DELETE',
    })

    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok) {
      setFetchError(data?.error ? String(data.error) : 'Não foi possível excluir o comentário.')
      return
    }

    await fetchComments()
  }, [disabled, fetchComments, orderId])

  return (
    <div className="space-y-3">
      {fetchError ? <p className="text-sm text-destructive">{fetchError}</p> : null}

      <div className="space-y-2 max-h-80 overflow-auto pr-1">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando histórico…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum comentário ainda.</p>
        ) : (
          messages.map((c) => {
            const hasCreated = Boolean(c.created_at)
            const when = hasCreated ? formatDateTimeBr(c.created_at) : '-'
            const isLegacy = c.id === 'legacy'
            const canEdit = !isLegacy && canManageComment(c)
            const isEditingThis = editingCommentId && editingCommentId === c.id

            return (
              <div key={c.id} className="rounded-md border bg-muted/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium">{c.author_display_name || '(Sem nome)'}</div>
                  <div className="text-xs text-muted-foreground">{when}</div>
                </div>

                {isEditingThis ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editingDraft}
                      onChange={(e) => setEditingDraft(e.target.value)}
                      disabled={disabled || isEditingSaving}
                      className="min-h-24"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <Button type="button" variant="outline" disabled={disabled || isEditingSaving} onClick={cancelEdit}>
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        disabled={disabled || isEditingSaving || editingDraft.trim().length === 0}
                        onClick={() => saveEdit(c.id)}
                      >
                        {isEditingSaving ? 'Salvando…' : 'Salvar'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">{c.content}</div>
                )}

                {!isLegacy && canEdit && !isEditingThis ? (
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={disabled}
                      onClick={() => startEdit(c.id, c.content)}
                    >
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={disabled}
                      onClick={() => deleteComment(c.id)}
                    >
                      Excluir
                    </Button>
                  </div>
                ) : null}
              </div>
            )
          })
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-medium">Adicionar comentário</div>
          <div className="text-xs text-muted-foreground">{draft.trim().length}/6000</div>
        </div>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={disabled ? 'Este registro está desabilitado.' : 'Descreva o que houve na assistência…'}
          disabled={disabled || isPosting}
          className="min-h-24"
        />

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={disabled || isPosting || draft.trim().length === 0}
            onClick={() => setDraft('')}
          >
            Limpar
          </Button>
          <Button
            type="button"
            disabled={disabled || isPosting || draft.trim().length === 0}
            onClick={sendComment}
          >
            {isPosting ? 'Enviando…' : 'Enviar'}
          </Button>
        </div>
      </div>
    </div>
  )
}

