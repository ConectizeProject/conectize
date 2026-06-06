'use client'

import { useCallback, useEffect, useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type InboxViewerOption = {
  id: string
  email: string | null
  full_name: string | null
  role: string | null
}

export type InboxAccessState = {
  unrestricted: boolean
  userIds: string[]
}

type Props = {
  connectionId: string | null
  disabled?: boolean
  value?: InboxAccessState
  onChange?: (state: InboxAccessState) => void
}

const defaultAccess: InboxAccessState = { unrestricted: true, userIds: [] }

export function HubInboxViewersPicker ({
  connectionId,
  disabled = false,
  value,
  onChange,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [team, setTeam] = useState<InboxViewerOption[]>([])
  const [unrestricted, setUnrestricted] = useState(defaultAccess.unrestricted)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const emit = useCallback(
    (nextUnrestricted: boolean, ids: Set<string>) => {
      onChange?.({
        unrestricted: nextUnrestricted,
        userIds: nextUnrestricted ? [] : [...ids],
      })
    },
    [onChange],
  )

  const loadTeam = useCallback(async () => {
    const res = await fetch('/api/portal/admin/usuarios?roles=admin,staff')
    const data = await res.json().catch(() => null)
    if (res.ok && data?.ok && Array.isArray(data.users)) {
      setTeam(
        data.users.map((u: InboxViewerOption) => ({
          id: String(u.id),
          email: u.email ?? null,
          full_name: u.full_name ?? null,
          role: u.role ?? null,
        })),
      )
    }
  }, [])

  const loadAccess = useCallback(
    async (hubId: string) => {
      setLoading(true)
      try {
        const res = await fetch(`/api/portal/hub/connections/item/${hubId}/inbox-viewers`)
        const data = await res.json().catch(() => null)
        if (res.ok && data?.ok) {
          const restricted = Boolean(data.restricted)
          const ids = Array.isArray(data.viewer_user_ids)
            ? (data.viewer_user_ids as string[])
            : []
          setUnrestricted(!restricted)
          setSelected(new Set(ids))
          emit(!restricted, new Set(ids))
        }
      } finally {
        setLoading(false)
      }
    },
    [emit],
  )

  useEffect(() => {
    void loadTeam()
  }, [loadTeam])

  useEffect(() => {
    if (!value) return
    setUnrestricted(value.unrestricted)
    setSelected(new Set(value.userIds))
  }, [value])

  useEffect(() => {
    if (!connectionId) return
    void loadAccess(connectionId)
  }, [connectionId, loadAccess])

  async function persist (nextUnrestricted: boolean, ids: Set<string>) {
    if (!connectionId || disabled) return
    setSaving(true)
    try {
      const res = await fetch(
        `/api/portal/hub/connections/item/${connectionId}/inbox-viewers`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            unrestricted: nextUnrestricted,
            viewer_user_ids: nextUnrestricted ? [] : [...ids],
          }),
        },
      )
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok) {
        const restricted = Boolean(data.restricted)
        const savedIds = Array.isArray(data.viewer_user_ids)
          ? (data.viewer_user_ids as string[])
          : []
        setUnrestricted(!restricted)
        setSelected(new Set(savedIds))
        emit(!restricted, new Set(savedIds))
      }
    } finally {
      setSaving(false)
    }
  }

  function handleUnrestrictedChange (checked: boolean) {
    setUnrestricted(checked)
    if (checked) {
      setSelected(new Set())
      emit(true, new Set())
      if (connectionId) void persist(true, new Set())
    } else {
      emit(false, selected)
    }
  }

  function handleUserToggle (userId: string, checked: boolean) {
    const next = new Set(selected)
    if (checked) next.add(userId)
    else next.delete(userId)
    setSelected(next)
    emit(unrestricted, next)
    if (!unrestricted && connectionId) void persist(false, next)
  }

  const pendingNote = !connectionId
    ? 'As permissões abaixo serão aplicadas ao clicar em Salvar (nova instância).'
    : null

  return (
    <div className="space-y-3 rounded-lg border px-3 py-3">
      <div>
        <p className="text-sm font-medium">Quem vê este canal na inbox</p>
        <p className="text-xs text-muted-foreground">
          Administradores da organização sempre veem todos os canais. Restrinja apenas equipe
          staff.
        </p>
        {pendingNote ? (
          <p className="mt-1 text-xs font-medium text-amber-800 dark:text-amber-200">
            {pendingNote}
          </p>
        ) : null}
      </div>

      {loading && connectionId ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando permissões…
        </div>
      ) : (
        <>
          <label className="flex cursor-pointer items-start gap-2">
            <Checkbox
              checked={unrestricted}
              disabled={disabled || saving}
              onCheckedChange={(v) => handleUnrestrictedChange(v === true)}
            />
            <span className="text-sm leading-tight">
              Toda a equipe (staff e admin da loja)
            </span>
          </label>

          {!unrestricted ? (
            <div
              className={cn(
                'max-h-40 space-y-2 overflow-y-auto rounded-md border bg-muted/30 p-2',
                team.length === 0 && 'text-xs text-muted-foreground',
              )}
            >
              {team.length === 0 ? (
                <p>Nenhum usuário staff/admin encontrado na organização.</p>
              ) : (
                team.map((u) => {
                  const label =
                    String(u.full_name || '').trim() ||
                    String(u.email || '').trim() ||
                    u.id
                  return (
                    <label
                      key={u.id}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={selected.has(u.id)}
                        disabled={disabled || saving}
                        onCheckedChange={(v) => handleUserToggle(u.id, v === true)}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {label}
                        {u.role ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({u.role})
                          </span>
                        ) : null}
                      </span>
                    </label>
                  )
                })
              )}
            </div>
          ) : null}

          {saving ? (
            <p className="text-xs text-muted-foreground">Salvando permissões…</p>
          ) : null}
        </>
      )}
    </div>
  )
}
