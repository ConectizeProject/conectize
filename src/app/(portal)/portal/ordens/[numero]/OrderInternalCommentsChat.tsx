'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { OsAssistAiIconButton } from '@/components/orders'
import { formatDateTimeBr } from '@/lib/utils/format-date'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { appConfirm } from '@/lib/ui/app-dialogs'

const INTERNAL_COMMENT_MAX_LENGTH = 6000

type InternalComment = {
  id: string
  content: string
  created_at: string
  author_display_name: string
  author_user_id: string | null
}

type Props = {
  orderId: string
  disabled?: boolean
  deviceContext?: string
}

export function OrderInternalCommentsChat({ orderId, disabled = false, deviceContext }: Props) {
  const [comments, setComments] = useState<InternalComment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [actorUserId, setActorUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  const [draft, setDraft] = useState('')
  const [isPosting, setIsPosting] = useState(false)

  const fetchComments = useCallback(async () => {
    setIsLoading(true)
    setFetchError(null)

    const res = await portalFetch(`/api/portal/ordens/${orderId}/internal-comments`)
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok || !Array.isArray(data?.comments)) {
      setFetchError(data?.error ? String(data.error) : 'Não foi possível carregar a descrição interna.')
      setComments([])
      setIsLoading(false)
      return
    }

    setActorUserId(typeof data?.actorUserId === 'string' ? data.actorUserId : null)
    setIsAdmin(Boolean(data?.isAdmin))

    setComments(data.comments as InternalComment[])
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
    if (content.length > INTERNAL_COMMENT_MAX_LENGTH) return

    setIsPosting(true)
    try {
      const res = await portalFetch(`/api/portal/ordens/${orderId}/internal-comments`, {
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

  const canManageComment = useCallback((c: InternalComment) => {
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
    if (content.length > INTERNAL_COMMENT_MAX_LENGTH) return

    setIsEditingSaving(true)
    try {
      const res = await portalFetch(`/api/portal/ordens/${orderId}/internal-comments/${commentId}`, {
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

    if (!(await appConfirm({
      title: 'Excluir comentário?',
      description: 'Excluir este comentário da descrição interna?',
      confirmLabel: 'Excluir',
      destructive: true,
    }))) return

    const res = await portalFetch(`/api/portal/ordens/${orderId}/internal-comments/${commentId}`, {
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
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : comments.length === 0 ? (
          <div className="rounded-md border bg-muted/20 p-3 flex items-center justify-center">
            <p className="text-sm text-muted-foreground text-center">Nenhum comentário interno ainda.</p>
          </div>
        ) : (
          comments.map((c) => {
            const hasCreated = Boolean(c.created_at)
            const when = hasCreated ? formatDateTimeBr(c.created_at) : '-'
            const canEdit = canManageComment(c)
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
                      maxLength={INTERNAL_COMMENT_MAX_LENGTH}
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

                {canEdit && !isEditingThis ? (
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
          <div className="text-sm font-medium min-w-0">Adicionar comentário</div>
          <OsAssistAiIconButton
            value={draft}
            onImproved={(text) => setDraft(text.slice(0, INTERNAL_COMMENT_MAX_LENGTH))}
            device={deviceContext}
            disabled={disabled || isPosting}
          />
        </div>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={disabled ? 'Este registro está desabilitado.' : 'Anotações internas (não aparecem para o cliente)…'}
          disabled={disabled || isPosting}
          maxLength={INTERNAL_COMMENT_MAX_LENGTH}
          className="min-h-24"
        />

        <div className="flex items-center justify-end">
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
