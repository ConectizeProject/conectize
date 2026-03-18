'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'

type WebhookRow = {
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
}

export function WebhooksListClient ({ webhooks }: Props) {
  const router = useRouter()
  const [detail, setDetail] = useState<WebhookRow | null>(null)
  const [reprocessingId, setReprocessingId] = useState<string | null>(null)

  async function handleReprocess (id: string) {
    setReprocessingId(id)
    try {
      const res = await fetch(`/api/portal/admin/webhooks/${id}/reprocess`, { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (data?.ok) {
        toast({ title: 'Reprocessado', description: 'Evento processado novamente.', variant: 'default' })
        router.refresh()
      } else {
        toast({
          title: 'Erro ao reprocessar',
          description: data?.error_message || data?.error || 'Tente novamente.',
          variant: 'destructive',
        })
        router.refresh()
      }
    } finally {
      setReprocessingId(null)
    }
  }

  return (
    <>
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
                      onClick={() => setDetail(row)}
                    >
                      Ver detalhes
                    </Button>
                    {row.status !== 'processed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={reprocessingId === row.id}
                        onClick={() => handleReprocess(row.id)}
                      >
                        {reprocessingId === row.id ? 'Processando…' : 'Reprocessar'}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Detalhe do webhook</DialogTitle>
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
                <div className="text-sm font-medium mb-1">Payload (JSON)</div>
                <pre className="rounded-md border bg-muted/50 p-3 text-xs overflow-auto max-h-[40vh] whitespace-pre-wrap break-all">
                  {JSON.stringify(detail.payload ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
