'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, HardDrive, Loader2, RefreshCw } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/hooks/use-toast'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { formatBytes } from '@/lib/utils/format-bytes'
import type { StorageUsageSummary } from '@/lib/admin/storage-usage'
import { ServiceOrderPhotosCleanupCard } from '@/app/(portal)/portal/admin/presets/ServiceOrderPhotosCleanupCard'
import { WhatsappMediaCleanupCard } from '@/app/(portal)/portal/admin/presets/WhatsappMediaCleanupCard'
import { ResaleDevicePhotosBrowserDialog } from '@/app/(portal)/portal/admin/armazenamento/ResaleDevicePhotosBrowserDialog'

type UsageResponse = StorageUsageSummary & {
  ok?: boolean
  error?: string
}

type ResaleBulkAction = 'keep-first' | 'delete-sold'

type ResaleBulkResponse = {
  ok?: boolean
  affectedDevices?: number
  deletedPhotos?: number
  storageRemoveErrors?: number
  error?: string
}

function clampPercent (value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

function formatPercent (value: number): string {
  if (!Number.isFinite(value)) return '0%'
  if (value < 1 && value > 0) return '<1%'
  return `${Math.round(value)}%`
}

function categoryDescription (key: string): string {
  if (key === 'os_entry') return 'Bucket order-entry-photos'
  if (key === 'os_exit') return 'Bucket order-exit-photos'
  if (key === 'os_assistance') return 'Bucket order-assistance-photos'
  if (key === 'whatsapp') return 'Bucket whatsapp-media'
  if (key === 'resale') return 'Bucket resale-device-photos'
  return 'Mídias armazenadas'
}

export function StorageUsageClient () {
  const [usage, setUsage] = useState<StorageUsageSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pendingResaleAction, setPendingResaleAction] = useState<ResaleBulkAction | null>(null)
  const [isRunningResaleAction, setIsRunningResaleAction] = useState(false)

  const loadUsage = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const res = await portalFetch('/api/portal/admin/storage/usage')
      const data = (await res?.json().catch(() => null)) as UsageResponse | null
      if (!res?.ok || data?.ok !== true) {
        throw new Error(data?.error || 'Não foi possível carregar o uso de storage.')
      }
      setUsage({
        project: data.project,
        organization: data.organization,
        buckets: data.buckets,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar uso de storage.'
      toast({ variant: 'destructive', title: 'Erro', description: message })
      setUsage(null)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadUsage()
  }, [loadUsage])

  async function runResaleBulkAction (action: ResaleBulkAction) {
    if (isRunningResaleAction) return
    setIsRunningResaleAction(true)
    try {
      const res = await portalFetch('/api/portal/admin/resale-device-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = (await res?.json().catch(() => null)) as ResaleBulkResponse | null
      if (!res?.ok || data?.ok !== true) {
        throw new Error(data?.error || 'Não foi possível limpar as fotos.')
      }

      const deletedPhotos = data.deletedPhotos ?? 0
      const affectedDevices = data.affectedDevices ?? 0
      const storageErrors = data.storageRemoveErrors ?? 0

      toast({
        variant: storageErrors > 0 ? 'destructive' : 'success',
        title: storageErrors > 0 ? 'Limpeza parcial' : 'Fotos de seminovos atualizadas',
        description:
          storageErrors > 0
            ? `${deletedPhotos} foto(s) processada(s), mas ${storageErrors} arquivo(s) falharam no storage.`
            : `${deletedPhotos} foto(s) removida(s) em ${affectedDevices} aparelho(s).`,
      })

      await loadUsage()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao limpar fotos.'
      toast({ variant: 'destructive', title: 'Erro', description: message })
    } finally {
      setIsRunningResaleAction(false)
      setPendingResaleAction(null)
    }
  }

  const projectPercent = useMemo(() => {
    if (!usage?.project.limitBytes) return 0
    return (usage.project.usedBytes / usage.project.limitBytes) * 100
  }, [usage])

  const orgTotal = usage?.organization.totalBytes ?? 0
  const quotaLabel = usage?.project.limitBytes
    ? `${formatBytes(usage.project.usedBytes)} de ${formatBytes(usage.project.limitBytes)}`
    : `${formatBytes(usage?.project.usedBytes ?? 0)} usados`
  const planLabel = usage?.project.plan ? usage.project.plan.toUpperCase() : 'Plano não identificado'

  return (
    <>
      <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" aria-hidden />
              Uso de storage do projeto
            </CardTitle>
            <CardDescription>
              Tamanho atual dos objetos no Supabase Storage. A cobrança oficial do Supabase usa média
              por período, então esta tela serve para inspeção e limpeza manual.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isRefreshing}
            onClick={() => void loadUsage()}
          >
            {isRefreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
            )}
            Atualizar
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Calculando uso de storage…
            </p>
          ) : usage ? (
            <>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div className="space-x-2">
                    <span className="font-medium">{quotaLabel}</span>
                    <Badge variant="secondary">{planLabel}</Badge>
                  </div>
                  {usage.project.limitBytes ? (
                    <span className="text-muted-foreground">
                      {formatPercent(projectPercent)} do limite
                    </span>
                  ) : null}
                </div>
                <Progress value={usage.project.limitBytes ? clampPercent(projectPercent) : 0} />
              </div>

              {usage.project.quotaError ? (
                <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <p>{usage.project.quotaError}</p>
                </div>
              ) : null}

              {!usage.project.limitBytes ? (
                <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <p>
                    O limite do plano não está disponível. Configure `SUPABASE_MANAGEMENT_ACCESS_TOKEN`
                    + `SUPABASE_ORG_SLUG`, ou `SUPABASE_STORAGE_QUOTA_GB`, para comparar o uso com a quota.
                  </p>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {usage.buckets.map((bucket) => (
                  <div key={bucket.bucketId} className="rounded-lg border p-3">
                    <p className="truncate text-sm font-medium">{bucket.bucketId}</p>
                    <p className="mt-1 text-xl font-semibold">{formatBytes(bucket.bytes)}</p>
                    <p className="text-xs text-muted-foreground">
                      {bucket.fileCount} arquivo(s)
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Não foi possível carregar o uso de storage.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sua organização</CardTitle>
          <CardDescription>
            Breakdown das mídias vinculadas à organização atual dentro dos buckets do projeto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usage ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {usage.organization.categories.map((category) => {
                const percent = orgTotal > 0 ? (category.bytes / orgTotal) * 100 : 0
                return (
                  <div key={category.key} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{category.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {categoryDescription(category.key)}
                        </p>
                      </div>
                      <Badge variant="outline">{formatPercent(percent)}</Badge>
                    </div>
                    <p className="mt-3 text-2xl font-semibold">{formatBytes(category.bytes)}</p>
                    <p className="text-xs text-muted-foreground">{category.fileCount} arquivo(s)</p>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Resumo indisponível.</p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Gerenciar mídias</h2>
          <p className="text-sm text-muted-foreground">
            Abra cada categoria para ver arquivos ordenados por tamanho e excluir manualmente.
          </p>
        </div>

        <Tabs defaultValue="service-orders" className="space-y-4">
          <TabsList className="flex h-auto w-full flex-wrap justify-start">
            <TabsTrigger value="service-orders">Ordens de serviço</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
            <TabsTrigger value="resale">Seminovos</TabsTrigger>
          </TabsList>

          <TabsContent value="service-orders">
            <ServiceOrderPhotosCleanupCard onStorageChanged={loadUsage} />
          </TabsContent>

          <TabsContent value="whatsapp">
            <WhatsappMediaCleanupCard onStorageChanged={loadUsage} />
          </TabsContent>

          <TabsContent value="resale">
            <Card>
              <CardHeader>
                <CardTitle>Fotos de seminovos</CardTitle>
                <CardDescription>
                  Fotos de capa e galeria dos aparelhos seminovos, ordenadas por tamanho para limpeza manual.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="text-sm text-muted-foreground">
                  Excluir uma foto remove o arquivo do storage e limpa a referência no cadastro do aparelho.
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isRunningResaleAction}
                    onClick={() => setPendingResaleAction('keep-first')}
                  >
                    Manter só a primeira
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={isRunningResaleAction}
                    onClick={() => setPendingResaleAction('delete-sold')}
                  >
                    Excluir fotos de vendidos
                  </Button>
                  <ResaleDevicePhotosBrowserDialog onPhotosChanged={loadUsage} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      </div>

      <AlertDialog
        open={pendingResaleAction !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPendingResaleAction(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingResaleAction === 'delete-sold'
                ? 'Excluir fotos de aparelhos vendidos?'
                : 'Manter somente a primeira foto?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingResaleAction === 'delete-sold'
                ? 'Todas as fotos de capa e galeria de aparelhos marcados como vendidos serão removidas permanentemente do storage.'
                : 'Para cada aparelho, a capa será mantida. Se não houver capa, a primeira foto da galeria será promovida para capa. As demais fotos serão removidas permanentemente.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRunningResaleAction}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={pendingResaleAction === 'delete-sold' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : undefined}
              disabled={isRunningResaleAction || pendingResaleAction === null}
              onClick={(event) => {
                event.preventDefault()
                if (pendingResaleAction) void runResaleBulkAction(pendingResaleAction)
              }}
            >
              {isRunningResaleAction ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Processando…
                </>
              ) : pendingResaleAction === 'delete-sold' ? (
                'Excluir fotos'
              ) : (
                'Manter primeira'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
