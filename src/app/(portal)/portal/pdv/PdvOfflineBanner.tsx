'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CloudOff, Loader2, RefreshCw, Wifi } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { maskedFromCents } from '@/lib/utils/money'
import { cn } from '@/lib/utils'
import { countPendingOfflineSales, listActionableOfflineSales } from '@/lib/pdv/offline/sales-queue'
import { syncOfflineSalesQueue } from '@/lib/pdv/offline/sync'
import type { PdvOfflineSale } from '@/lib/pdv/offline/types'

type Props = {
  organizationId: string | null
  cashOpen: boolean
  queueVersion?: number
  onSynced?: () => void
}

function statusLabel (status: PdvOfflineSale['status']) {
  if (status === 'pending') return 'Aguardando'
  if (status === 'syncing') return 'Enviando'
  if (status === 'failed') return 'Falhou'
  return 'Enviada'
}

export function PdvOfflineBanner ({ organizationId, cashOpen, queueVersion = 0, onSynced }: Props) {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [rows, setRows] = useState<PdvOfflineSale[]>([])
  const syncingRef = useRef(false)

  const refreshCounts = useCallback(async () => {
    if (!organizationId) {
      setPendingCount(0)
      setRows([])
      return
    }
    const [count, list] = await Promise.all([
      countPendingOfflineSales(organizationId),
      listActionableOfflineSales(organizationId),
    ])
    setPendingCount(count)
    setRows(list)
  }, [organizationId])

  const runSync = useCallback(async (options?: { silent?: boolean }) => {
    if (!organizationId || syncingRef.current) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (!options?.silent) {
        toast({
          title: 'Sem conexão',
          description: 'As vendas offline serão enviadas quando a rede voltar.',
          variant: 'destructive',
        })
      }
      return
    }
    syncingRef.current = true
    setSyncing(true)
    try {
      const result = await syncOfflineSalesQueue(organizationId)
      await refreshCounts()
      if (result.synced > 0) onSynced?.()
      if (!options?.silent) {
        if (result.synced > 0 && result.failed === 0) {
          toast({
            title: result.synced === 1
              ? '1 venda offline enviada'
              : `${result.synced} vendas offline enviadas`,
          })
        } else if (result.synced > 0 && result.failed > 0) {
          toast({
            title: `${result.synced} enviada(s), ${result.failed} com erro`,
            variant: 'destructive',
          })
        } else if (result.failed > 0) {
          toast({
            title: 'Não foi possível enviar vendas offline',
            description: result.results.find((r) => !r.ok)?.error,
            variant: 'destructive',
          })
        } else if (result.attempted === 0) {
          toast({ title: 'Nenhuma venda pendente' })
        }
      } else if (result.synced > 0) {
        toast({
          title: result.synced === 1
            ? '1 venda offline sincronizada'
            : `${result.synced} vendas offline sincronizadas`,
        })
      }
    } finally {
      syncingRef.current = false
      setSyncing(false)
    }
  }, [organizationId, refreshCounts, onSynced])

  useEffect(() => {
    function handleOnline () {
      setIsOnline(true)
      void refreshCounts().then(() => {
        void runSync({ silent: true })
      })
    }
    function handleOffline () {
      setIsOnline(false)
    }
    setIsOnline(typeof navigator === 'undefined' ? true : navigator.onLine)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [refreshCounts, runSync])

  useEffect(() => {
    void refreshCounts()
  }, [refreshCounts, cashOpen, queueVersion])

  if (!organizationId) return null
  if (isOnline && pendingCount === 0) return null

  return (
    <>
      <div
        className={cn(
          'flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm',
          isOnline
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100'
            : 'border-destructive/30 bg-destructive/10 text-destructive',
        )}
        role="status"
      >
        {isOnline ? (
          <Wifi className="h-4 w-4 shrink-0" aria-hidden />
        ) : (
          <CloudOff className="h-4 w-4 shrink-0" aria-hidden />
        )}
        <p className="min-w-0 flex-1">
          {isOnline
            ? (
              pendingCount === 1
                ? 'Há 1 venda offline aguardando envio.'
                : `Há ${pendingCount} vendas offline aguardando envio.`
            )
            : (
              pendingCount > 0
                ? `Sem conexão. ${pendingCount} venda(s) ficarão na fila até a rede voltar.`
                : 'Sem conexão. Você pode vender com o catálogo em cache; as vendas entram na fila.'
            )}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {pendingCount > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => {
                void refreshCounts()
                setDialogOpen(true)
              }}
            >
              Ver pendências
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            className="h-8"
            disabled={syncing || !isOnline || pendingCount === 0}
            onClick={() => void runSync()}
          >
            {syncing ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            )}
            Enviar agora
          </Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Vendas offline</DialogTitle>
            <DialogDescription>
              Vendas finalizadas sem rede. Ao sincronizar, o servidor aplica estoque e financeiro.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] space-y-2 overflow-auto">
            {rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma pendência.</p>
            ) : (
              rows.map((row) => (
                <div
                  key={row.id}
                  className="rounded-md border border-border/80 px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate text-sm font-medium">
                        {row.summary.customerName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(row.createdAt).toLocaleString('pt-BR')}
                        <span className="mx-1.5 text-muted-foreground/40" aria-hidden>·</span>
                        {row.summary.itemCount} item(ns)
                        <span className="mx-1.5 text-muted-foreground/40" aria-hidden>·</span>
                        {maskedFromCents(row.summary.totalCents)}
                      </p>
                      {row.lastError ? (
                        <p className="text-xs text-destructive">{row.lastError}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {statusLabel(row.status)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Fechar
            </Button>
            <Button
              type="button"
              disabled={syncing || !isOnline || pendingCount === 0}
              onClick={() => void runSync()}
            >
              {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sincronizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
