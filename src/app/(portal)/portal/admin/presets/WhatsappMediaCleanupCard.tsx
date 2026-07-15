'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { formatMediaSizeBytes } from '@/lib/whatsapp/whatsapp-media-admin'
import { WhatsappMediaBrowserDialog } from '@/app/(portal)/portal/admin/presets/WhatsappMediaBrowserDialog'

type ImagesResponse = {
  ok?: boolean
  images?: Array<{ sizeBytes: number }>
  error?: string
}

type WhatsappMediaCleanupCardProps = {
  onStorageChanged?: () => void | Promise<void>
}

export function WhatsappMediaCleanupCard ({
  onStorageChanged,
}: WhatsappMediaCleanupCardProps) {
  const [imageCount, setImageCount] = useState<number | null>(null)
  const [totalBytes, setTotalBytes] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const loadSummary = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await portalFetch('/api/portal/admin/whatsapp-media')
      const data = (await res?.json().catch(() => null)) as ImagesResponse | null
      if (!res?.ok || data?.ok !== true) {
        throw new Error(data?.error || 'Não foi possível carregar o resumo.')
      }
      const images = data.images ?? []
      setImageCount(images.length)
      setTotalBytes(images.reduce((sum, image) => sum + (image.sizeBytes ?? 0), 0))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar resumo.'
      toast({ variant: 'destructive', title: 'Erro', description: message })
      setImageCount(null)
      setTotalBytes(0)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Imagens do WhatsApp</CardTitle>
        <CardDescription>
          Imagens baixadas das conversas e armazenadas temporariamente no portal (~24 h). Você
          pode visualizá-las por tamanho e excluir manualmente para liberar espaço.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 text-sm text-muted-foreground">
          {isLoading ? (
            <p className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Calculando imagens armazenadas…
            </p>
          ) : imageCount === null ? (
            <p>Não foi possível estimar quantas imagens estão armazenadas.</p>
          ) : imageCount === 0 ? (
            <p>Nenhuma imagem do WhatsApp armazenada no momento.</p>
          ) : (
            <>
              <p>
                <span className="font-medium text-foreground">{imageCount}</span> imagem(ns)
                armazenada(s)
                {totalBytes > 0 ? ` · ${formatMediaSizeBytes(totalBytes)}` : ''}.
              </p>
              <p>Excluir uma imagem remove o arquivo, mas mantém a mensagem no histórico.</p>
            </>
          )}
        </div>

        <WhatsappMediaBrowserDialog
          onImagesChanged={async () => {
            await loadSummary()
            await onStorageChanged?.()
          }}
        />
      </CardContent>
    </Card>
  )
}
