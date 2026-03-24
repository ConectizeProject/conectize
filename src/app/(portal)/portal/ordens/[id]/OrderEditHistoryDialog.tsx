'use client'

import { useCallback, useState } from 'react'
import { History, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatDateTimeBr } from '@/lib/utils/format-date'
import { formatCentsBr } from '@/lib/utils/format-money'
import { ORDER_EDIT_FIELD_LABELS } from '@/lib/orders/order-edit-history'

const STATUS_LABELS: Record<string, string> = {
  orcamento: 'Orçamento',
  aguardando_aprovacao: 'Aguardando aprovação',
  aprovado: 'Aprovado',
  aguardando_pecas: 'Aguardando peças',
  em_manutencao: 'Em manutenção',
  aguardando_retirada: 'Aguardando retirada',
  finalizada: 'Finalizada',
  finalizada_sem_conserto: 'Finalizada sem conserto',
  finalizada_sem_aprovacao: 'Finalizada sem aprovação',
  cancelada: 'Cancelada',
}

type Entry = {
  id: string
  edited_at: string
  edited_by: string
  editor_display_name: string
  field_key: string
  old_value: string | null
  new_value: string | null
}

function formatDisplayValue (fieldKey: string, raw: string | null | undefined): string {
  const v = raw ?? ''
  if (fieldKey === 'status') return (STATUS_LABELS[v] ?? v) || '(vazio)'
  if (fieldKey === 'is_warranty') {
    if (v === 'true') return 'Sim'
    if (v === 'false') return 'Não'
    return v || '(vazio)'
  }
  if (fieldKey === 'estimated_ready_at' || fieldKey === 'closed_at') {
    if (!v) return '(vazio)'
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return v
    return formatDateTimeBr(d.toISOString())
  }
  if (fieldKey === 'services_total_cents' || fieldKey === 'services_cost_total_cents') {
    if (!v) return '(vazio)'
    const n = Number.parseInt(v, 10)
    if (!Number.isFinite(n)) return v
    return formatCentsBr(n)
  }
  if (fieldKey === 'passcode_type') {
    if (!v) return '(nenhuma)'
    if (v === 'text') return 'Texto'
    if (v === 'pattern') return 'Padrão'
    return v
  }
  if (!v) return '(vazio)'
  if (fieldKey === 'payment_methods' || fieldKey === 'services' || fieldKey === 'device_entry_checks') {
    try {
      const parsed = JSON.parse(v)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return v
    }
  }
  return v
}

type Props = {
  orderId: string
  /** Se true, permite excluir linhas do histórico (admin) */
  isAdmin?: boolean
}

export function OrderEditHistoryDialog ({ orderId, isAdmin = false }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteActionError, setDeleteActionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/portal/ordens/${orderId}/edit-history`)
      const data = await res.json()
      if (!res.ok || !data?.ok) {
        setError('Não foi possível carregar o histórico.')
        setEntries([])
        return
      }
      setEntries(Array.isArray(data.entries) ? data.entries : [])
    } catch {
      setError('Não foi possível carregar o histórico.')
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [orderId])

  function handleOpenChange (next: boolean) {
    setOpen(next)
    if (next) void load()
  }

  const confirmDelete = useCallback(async () => {
    if (!pendingDeleteId) return
    const idToRemove = pendingDeleteId
    setDeletingId(idToRemove)
    setDeleteActionError(null)
    try {
      const res = await fetch(
        `/api/portal/ordens/${orderId}/edit-history/${idToRemove}`,
        { method: 'DELETE' },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        setDeleteActionError('Não foi possível excluir este registro do histórico.')
        return
      }
      setEntries((prev) => prev.filter((e) => e.id !== idToRemove))
      setPendingDeleteId(null)
    } catch {
      setDeleteActionError('Não foi possível excluir este registro do histórico.')
    } finally {
      setDeletingId(null)
    }
  }, [orderId, pendingDeleteId])

  const groups = new Map<string, Entry[]>()
  for (const e of entries) {
    const key = `${e.edited_at}|${e.edited_by}`
    const prev = groups.get(key) ?? []
    prev.push(e)
    groups.set(key, prev)
  }

  const groupKeys = [...groups.keys()].sort((a, b) => {
    const ta = new Date(a.split('|')[0] || '').getTime()
    const tb = new Date(b.split('|')[0] || '').getTime()
    return tb - ta
  })

  return (
    <>
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      modal={pendingDeleteId === null}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" title="Histórico de edições">
          <History className="h-4 w-4" />
          <span className="ml-1.5 hidden sm:inline">Histórico</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Histórico de edições</DialogTitle>
          <DialogDescription>
            Alterações salvas nesta ordem, com autor e data/hora.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma edição registrada ainda.</p>
          ) : (
            <div className="space-y-6 text-sm">
              {groupKeys.map((key) => {
                const block = groups.get(key) ?? []
                const first = block[0]
                if (!first) return null
                return (
                  <div key={key} className="space-y-2 border-b pb-4 last:border-0">
                    <div className="space-y-0.5 text-muted-foreground">
                      <p>
                        <span className="font-medium text-foreground">{first.editor_display_name}</span>
                        {' · '}
                        {formatDateTimeBr(first.edited_at)}
                      </p>
                    </div>
                    <ul className="space-y-3 list-none pl-0">
                      {block.map((row) => {
                        const label = ORDER_EDIT_FIELD_LABELS[row.field_key] ?? row.field_key
                        const isDeletingRow = deletingId === row.id
                        return (
                          <li key={row.id} className="rounded-md border bg-muted/30 p-3 space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-medium text-foreground pr-2">{label}</p>
                              {isAdmin && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                                  title="Excluir este registro do histórico"
                                  disabled={isDeletingRow}
                                  onClick={() => {
                                    setDeleteActionError(null)
                                    setPendingDeleteId(row.id)
                                  }}
                                >
                                  {isDeletingRow ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                            <div className="grid gap-1 sm:grid-cols-2">
                              <div>
                                <p className="text-xs uppercase text-muted-foreground">Antes</p>
                                <pre className="whitespace-pre-wrap break-words text-xs mt-0.5 text-muted-foreground">
                                  {formatDisplayValue(row.field_key, row.old_value)}
                                </pre>
                              </div>
                              <div>
                                <p className="text-xs uppercase text-muted-foreground">Depois</p>
                                <pre className="whitespace-pre-wrap break-words text-xs mt-0.5">
                                  {formatDisplayValue(row.field_key, row.new_value)}
                                </pre>
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(next) => {
          if (!next) {
            setPendingDeleteId(null)
            setDeleteActionError(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro do histórico?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove permanentemente esta linha do histórico de alterações. Não é possível desfazer.
            </AlertDialogDescription>
            {deleteActionError ? (
              <p className="text-sm text-destructive pt-2">{deleteActionError}</p>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingId !== null}>Cancelar</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deletingId !== null}
              onClick={() => void confirmDelete()}
            >
              {deletingId ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2 inline" />
                  Excluindo…
                </>
              ) : (
                'Excluir'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
