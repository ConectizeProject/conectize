'use client'

import { useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { portalFetch } from '@/lib/portal/portal-fetch'
import {
  WEBHOOK_PURGE_PLATFORMS,
  WEBHOOK_RECORD_PURGE_SCOPES,
  webhookRecordPurgeCutoffIso,
  type WebhookPurgePlatform,
  type WebhookRecordPurgeScope,
} from '@/lib/integrations/webhook-records-cleanup'

type PurgeResponse = {
  ok?: boolean
  deleted?: number
  error?: string
}

function formatCutoffDate (iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('pt-BR')
}

function platformPhrase (platform: WebhookPurgePlatform): string {
  if (platform === 'bling') return 'do Bling'
  if (platform === 'mercado_livre') return 'do Mercado Livre'
  return 'de todas as plataformas'
}

export function WebhookRecordsCleanupCard () {
  const [scope, setScope] = useState<WebhookRecordPurgeScope>('90d')
  const [platform, setPlatform] = useState<WebhookPurgePlatform>('all')
  const [isCleaning, setIsCleaning] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const selectedScope = WEBHOOK_RECORD_PURGE_SCOPES.find((item) => item.id === scope)
  const platformLabel = platformPhrase(platform)
  const cutoffLabel = formatCutoffDate(webhookRecordPurgeCutoffIso(scope))

  async function handleCleanup () {
    if (isCleaning) return
    setIsCleaning(true)

    try {
      const res = await portalFetch('/api/portal/admin/webhooks/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, platform }),
      })
      const data = (await res?.json().catch(() => null)) as PurgeResponse | null
      if (!res?.ok || data?.ok !== true) {
        throw new Error(data?.error || 'Não foi possível excluir os registros.')
      }

      const deleted = data.deleted ?? 0
      toast({
        variant: 'success',
        title: deleted > 0 ? 'Registros excluídos' : 'Nada para excluir',
        description: deleted > 0
          ? `${deleted} registro(s) de webhook removido(s) do banco.`
          : 'Não havia registros nesse filtro.',
      })

      setDialogOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir registros.'
      toast({ variant: 'destructive', title: 'Erro', description: message })
    } finally {
      setIsCleaning(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registros de webhooks</CardTitle>
        <CardDescription>
          Apaga o histórico de webhooks já recebidos (Bling e Mercado Livre) para liberar espaço no
          banco. Pedidos e estoque já processados permanecem. O Postgres reaproveita o espaço na
          limpeza automática, então o tamanho em disco pode levar um tempo para cair.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="space-y-1.5">
            <label htmlFor="webhook-purge-platform" className="text-sm font-medium">
              Plataforma
            </label>
            <Select
              value={platform}
              onValueChange={(value) => setPlatform(value as WebhookPurgePlatform)}
              disabled={isCleaning}
            >
              <SelectTrigger id="webhook-purge-platform" className="w-full sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEBHOOK_PURGE_PLATFORMS.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="webhook-purge-scope" className="text-sm font-medium">
              O que excluir
            </label>
            <Select
              value={scope}
              onValueChange={(value) => setScope(value as WebhookRecordPurgeScope)}
              disabled={isCleaning}
            >
              <SelectTrigger id="webhook-purge-scope" className="w-full sm:w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEBHOOK_RECORD_PURGE_SCOPES.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="text-sm text-muted-foreground lg:max-w-md">
          {cutoffLabel
            ? `Apaga registros ${platformLabel} criados até ${cutoffLabel}.`
            : `Apaga todos os registros ${platformLabel}.`}
        </p>

        <Button
          type="button"
          variant="destructive"
          disabled={isCleaning}
          onClick={() => setDialogOpen(true)}
        >
          {isCleaning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Excluindo…
            </>
          ) : (
            <>
              <Trash2 className="mr-2 h-4 w-4" aria-hidden />
              Excluir registros
            </>
          )}
        </Button>
      </CardContent>

      <AlertDialog
        open={dialogOpen}
        onOpenChange={(nextOpen) => {
          if (isCleaning) return
          setDialogOpen(nextOpen)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registros de webhooks?</AlertDialogTitle>
            <AlertDialogDescription>
              {`${selectedScope?.label ?? 'Os registros do filtro escolhido'} ${platformLabel} serão apagados do banco${cutoffLabel ? ` (criados até ${cutoffLabel})` : ''}. Isso não desfaz pedidos ou estoque já processados. Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCleaning}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isCleaning}
              onClick={(event) => {
                event.preventDefault()
                void handleCleanup()
              }}
            >
              {isCleaning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Excluindo…
                </>
              ) : (
                'Excluir permanentemente'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
