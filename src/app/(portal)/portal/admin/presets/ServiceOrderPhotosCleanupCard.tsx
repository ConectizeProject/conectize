'use client'

import { useCallback, useEffect, useState } from 'react'
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { ServiceOrderPhotosBrowserDialog } from '@/app/(portal)/portal/admin/presets/ServiceOrderPhotosBrowserDialog'

type PreviewResponse = {
  ok?: boolean
  entryCount?: number
  exitCount?: number
  assistanceCount?: number
  totalCount?: number
  cutoffAt?: string
  retentionMonths?: number
  error?: string
}

type CleanupResponse = PreviewResponse & {
  entryDeleted?: number
  exitDeleted?: number
  assistanceDeleted?: number
  storageRemoveErrors?: number
}

type ServiceOrderPhotosCleanupCardProps = {
  onStorageChanged?: () => void | Promise<void>
}

function formatCutoffDate (iso: string | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('pt-BR')
}

export function ServiceOrderPhotosCleanupCard ({
  onStorageChanged,
}: ServiceOrderPhotosCleanupCardProps) {
  const [entryCount, setEntryCount] = useState<number | null>(null)
  const [exitCount, setExitCount] = useState<number | null>(null)
  const [assistanceCount, setAssistanceCount] = useState<number | null>(null)
  const [cutoffAt, setCutoffAt] = useState<string | null>(null)
  const [retentionMonths, setRetentionMonths] = useState(3)
  const [isLoadingPreview, setIsLoadingPreview] = useState(true)
  const [isCleaning, setIsCleaning] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const loadPreview = useCallback(async () => {
    setIsLoadingPreview(true)
    try {
      const res = await portalFetch('/api/portal/admin/service-order-photos/cleanup')
      const data = (await res?.json().catch(() => null)) as PreviewResponse | null
      if (!res?.ok || data?.ok !== true) {
        throw new Error(data?.error || 'Não foi possível carregar a prévia.')
      }
      setEntryCount(data.entryCount ?? 0)
      setExitCount(data.exitCount ?? 0)
      setAssistanceCount(data.assistanceCount ?? 0)
      setCutoffAt(data.cutoffAt ?? null)
      setRetentionMonths(data.retentionMonths ?? 3)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar prévia.'
      toast({ variant: 'destructive', title: 'Erro', description: message })
      setEntryCount(null)
      setExitCount(null)
      setAssistanceCount(null)
    } finally {
      setIsLoadingPreview(false)
    }
  }, [])

  useEffect(() => {
    void loadPreview()
  }, [loadPreview])

  const totalCount = (entryCount ?? 0) + (exitCount ?? 0) + (assistanceCount ?? 0)

  async function handleCleanup () {
    if (isCleaning) return
    setIsCleaning(true)
    try {
      const res = await portalFetch('/api/portal/admin/service-order-photos/cleanup', {
        method: 'POST',
      })
      const data = (await res?.json().catch(() => null)) as CleanupResponse | null
      if (!res?.ok || data?.ok !== true) {
        throw new Error(data?.error || 'Não foi possível excluir as fotos.')
      }

      const deleted =
        (data.entryDeleted ?? 0) + (data.exitDeleted ?? 0) + (data.assistanceDeleted ?? 0)
      const storageErrors = data.storageRemoveErrors ?? 0

      toast({
        variant: storageErrors > 0 ? 'destructive' : 'success',
        title: storageErrors > 0 ? 'Limpeza parcial' : 'Fotos excluídas',
        description:
          storageErrors > 0
            ? `${deleted} referência(s) removida(s); ${storageErrors} arquivo(s) no storage falharam.`
            : `${deleted} foto(s) de OS removida(s) (entrada: ${data.entryDeleted ?? 0}, saída: ${data.exitDeleted ?? 0}, assistência: ${data.assistanceDeleted ?? 0}).`,
      })

      setDialogOpen(false)
      await loadPreview()
      await onStorageChanged?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir fotos.'
      toast({ variant: 'destructive', title: 'Erro', description: message })
    } finally {
      setIsCleaning(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fotos de ordens de serviço</CardTitle>
        <CardDescription>
          Remove fotos de entrada, saída e assistência com mais de {retentionMonths} meses, apagando o arquivo no
          storage e a referência no banco de dados.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 text-sm text-muted-foreground">
          {isLoadingPreview ? (
            <p className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Calculando fotos elegíveis…
            </p>
          ) : entryCount === null ? (
            <p>Não foi possível estimar quantas fotos serão removidas.</p>
          ) : totalCount === 0 ? (
            <p>
              Nenhuma foto anterior a {formatCutoffDate(cutoffAt ?? undefined)}.
            </p>
          ) : (
            <>
              <p>
                <span className="font-medium text-foreground">{totalCount}</span> foto(s) elegíveis
                (entrada: {entryCount}, saída: {exitCount}, assistência: {assistanceCount}).
              </p>
              <p>Criadas antes de {formatCutoffDate(cutoffAt ?? undefined)}.</p>
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <ServiceOrderPhotosBrowserDialog
            onPhotosChanged={async () => {
              await loadPreview()
              await onStorageChanged?.()
            }}
          />

          <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="destructive"
              disabled={isLoadingPreview || isCleaning || totalCount === 0}
            >
              {isCleaning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Excluindo…
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                  Excluir fotos antigas
                </>
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir fotos antigas de OS?</AlertDialogTitle>
              <AlertDialogDescription>
                Serão removidas {totalCount} foto(s) de entrada e saída criadas antes de{' '}
                {formatCutoffDate(cutoffAt ?? undefined)}. Os arquivos no storage também serão
                apagados. Esta ação não pode ser desfeita.
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
                Excluir permanentemente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </div>
      </CardContent>
    </Card>
  )
}
