'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Loader2, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { appConfirm } from '@/lib/ui/app-dialogs'

export type WebhookRow = {
  id: string
  platform_id: string
  event_type: string
  external_id: string | null
  status: string
  error_message: string | null
  retry_count: number
  processed_at: string | null
  created_at: string
  payload?: unknown
}

type Props = {
  webhooks: WebhookRow[]
  platform?: string
}

function safeJsonStringify (value: unknown, space?: number): string {
  try {
    const seen = new WeakSet<object>()
    return JSON.stringify(value, (_key, val) => {
      if (val != null && typeof val === 'object') {
        const o = val as object
        if (seen.has(o)) return '[Circular]'
        seen.add(o)
      }
      return val
    }, space)
  } catch {
    try {
      return String(value)
    } catch {
      return '[payload não serializável]'
    }
  }
}

export function WebhooksListClient ({ webhooks, platform = 'bling' }: Props) {
  const router = useRouter()
  const [detail, setDetail] = useState<WebhookRow | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [reprocessingId, setReprocessingId] = useState<string | null>(null)
  const [isReprocessingAllErrors, setIsReprocessingAllErrors] = useState(false)
  const [isPurgingOld, setIsPurgingOld] = useState(false)
  const [copyingPayload, setCopyingPayload] = useState(false)
  const errorRows = webhooks.filter((row) => row.status === 'error' && row.platform_id === 'bling')

  async function openDetail (row: WebhookRow) {
    setDetail(row)
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/portal/admin/webhooks/${row.id}`, {
        method: 'GET',
        credentials: 'include',
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok || !data?.webhook) {
        toast({
          title: 'Falha ao carregar detalhe',
          description: String(data?.message || data?.error || 'Tente novamente.'),
          variant: 'destructive',
        })
        return
      }
      setDetail(data.webhook as WebhookRow)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha de rede.'
      toast({
        title: 'Falha ao carregar detalhe',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setDetailLoading(false)
    }
  }

  async function handleReprocess (id: string) {
    setReprocessingId(id)
    try {
      const res = await fetch(`/api/portal/admin/webhooks/${id}/reprocess`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => null)
      if (data?.ok) {
        toast({ title: 'Reprocessado', description: 'Evento processado novamente.', variant: 'success' })
        router.refresh()
      } else {
        toast({
          title: 'Erro ao reprocessar',
          description: data?.error_message || data?.error || 'Tente novamente.',
          variant: 'destructive',
        })
        router.refresh()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha de rede ao reprocessar.'
      toast({
        title: 'Erro ao reprocessar',
        description: message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setReprocessingId(null)
    }
  }

  async function copyWebhookPayload () {
    if (!detail) return
    setCopyingPayload(true)
    try {
      const text = safeJsonStringify(detail.payload ?? {}, 2)
      await navigator.clipboard.writeText(text)
      toast({
        title: 'Copiado',
        description: 'Payload do webhook copiado para a área de transferência.',
      })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Não foi possível copiar',
        description: 'Verifique permissão do navegador para a área de transferência.',
      })
    } finally {
      setCopyingPayload(false)
    }
  }

  async function handleReprocessAllErrors () {
    if (isReprocessingAllErrors) return
    setIsReprocessingAllErrors(true)
    try {
      const res = await fetch('/api/portal/admin/webhooks/reprocess-errors', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => null)
      if (data?.ok) {
        const processed = Number(data.processed || 0)
        const failed = Number(data.failed || 0)
        const total = Number(data.total || 0)
        const description =
          total === 0
            ? 'Nenhum webhook com erro para reprocessar.'
            : failed > 0
              ? `Processados: ${processed} • Falhas: ${failed}`
              : `Todos os ${processed} webhooks com erro foram reprocessados.`
        toast({
          title: 'Reprocessamento em lote concluído',
          description,
          variant: failed > 0 ? 'default' : 'success',
        })
      } else {
        toast({
          title: 'Erro ao reprocessar em lote',
          description: data?.error_message || data?.error || 'Tente novamente.',
          variant: 'destructive',
        })
      }
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha de rede ao reprocessar em lote.'
      toast({
        title: 'Erro ao reprocessar em lote',
        description: message || 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsReprocessingAllErrors(false)
    }
  }

  async function handlePurgeOlderThanThreeMonths () {
    if (isPurgingOld) return
    if (!(await appConfirm({
      title: 'Excluir histórico antigo?',
      description: 'Remove permanentemente os webhooks desta plataforma com mais de 3 meses. Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      destructive: true,
    }))) return

    setIsPurgingOld(true)
    try {
      const res = await fetch('/api/portal/admin/webhooks/purge-old', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast({
          title: 'Falha ao excluir histórico',
          description: String(data?.message || data?.error || 'Tente novamente.'),
          variant: 'destructive',
        })
        return
      }

      const deleted = Number(data.deleted || 0)
      toast({
        variant: 'success',
        title: deleted > 0 ? 'Histórico antigo excluído' : 'Nada para excluir',
        description:
          deleted > 0
            ? `${deleted} webhook(s) com mais de 3 meses removido(s).`
            : 'Não havia webhooks com mais de 3 meses.',
      })
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha de rede.'
      toast({
        title: 'Falha ao excluir histórico',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsPurgingOld(false)
    }
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handlePurgeOlderThanThreeMonths()}
          disabled={isPurgingOld || isReprocessingAllErrors}
          className="gap-1.5"
        >
          {isPurgingOld
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Trash2 className="h-4 w-4" />}
          Excluir &gt; 3 meses
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleReprocessAllErrors()}
          disabled={isReprocessingAllErrors || isPurgingOld || errorRows.length === 0}
          className="gap-1.5"
        >
          {isReprocessingAllErrors
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <RotateCcw className="h-4 w-4" />}
          {`Reprocessar todos com erro (${errorRows.length})`}
        </Button>
      </div>

      {webhooks.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-2 pr-2 text-left font-medium">Data</th>
                <th className="py-2 px-2 text-left font-medium">Tipo</th>
                <th className="py-2 px-2 text-left font-medium">Recurso</th>
                <th className="py-2 px-2 text-center font-medium">Status</th>
                <th className="py-2 px-2 text-left font-medium">Erro</th>
                <th className="py-2 px-2 text-center font-medium">Tentativas</th>
                <th className="py-2 pl-2 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {webhooks.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="py-2 pr-2 align-top whitespace-nowrap">
                    {row.created_at ? new Date(row.created_at).toLocaleString('pt-BR') : '-'}
                  </td>
                  <td className="py-2 px-2 align-top">{row.event_type || '-'}</td>
                  <td className="py-2 px-2 align-top font-mono text-xs">{row.external_id || '-'}</td>
                  <td className="py-2 px-2 align-top text-center">
                    <span
                      className={
                        row.status === 'processed'
                          ? 'rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium uppercase text-green-600 dark:text-green-400'
                          : row.status === 'error'
                            ? 'rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium uppercase text-destructive'
                            : 'rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-600 dark:text-amber-400'
                      }
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="py-2 px-2 align-top max-w-[200px] truncate" title={row.error_message ?? undefined}>
                    {row.error_message ? String(row.error_message).slice(0, 80) + (row.error_message.length > 80 ? '…' : '') : '-'}
                  </td>
                  <td className="py-2 px-2 align-top text-center">{row.retry_count ?? 0}</td>
                  <td className="py-2 pl-2 align-top text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void openDetail(row)}
                      >
                        Ver detalhes
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={reprocessingId === row.id}
                        onClick={() => handleReprocess(row.id)}
                        title="Reprocessar webhook"
                        aria-label="Reprocessar webhook"
                      >
                        {reprocessingId === row.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <RotateCcw className="h-4 w-4" />}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Detalhe do webhook</DialogTitle>
            <DialogDescription>
              Informações completas do evento recebido e payload original.
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="flex flex-col gap-3 overflow-auto min-h-0">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="font-medium">ID:</span> {detail.id}</div>
                <div><span className="font-medium">Status:</span> {detail.status}</div>
                <div><span className="font-medium">Tipo:</span> {detail.event_type}</div>
                <div><span className="font-medium">Recurso:</span> {detail.external_id ?? '-'}</div>
                {detail.error_message && (
                  <div className="col-span-2">
                    <span className="font-medium">Erro:</span>{' '}
                    <span className="text-destructive">{detail.error_message}</span>
                  </div>
                )}
              </div>
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <div className="text-sm font-medium">Payload (JSON)</div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    disabled={copyingPayload || detailLoading}
                    onClick={() => void copyWebhookPayload()}
                  >
                    {copyingPayload
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Copy className="h-3.5 w-3.5" />}
                    Copiar payload
                  </Button>
                </div>
                {detailLoading ? (
                  <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Carregando payload…
                  </div>
                ) : (
                  <pre className="rounded-md border bg-muted/50 p-3 text-xs overflow-auto max-h-[40vh] whitespace-pre-wrap break-all">
                    {safeJsonStringify(detail.payload ?? {}, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
