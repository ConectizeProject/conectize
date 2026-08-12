'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { ExternalLink, Images, Loader2, Trash2 } from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from '@/hooks/use-toast'
import { portalFetch } from '@/lib/portal/portal-fetch'
import {
  formatMediaSizeBytes,
  type WhatsappMediaListItem,
} from '@/lib/whatsapp/whatsapp-media-admin'

type ImagesResponse = {
  ok?: boolean
  images?: WhatsappMediaListItem[]
  error?: string
}

type WhatsappMediaBrowserDialogProps = {
  onImagesChanged?: () => void | Promise<void>
}

function formatImageDate (iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('pt-BR')
}

export function WhatsappMediaBrowserDialog ({
  onImagesChanged,
}: WhatsappMediaBrowserDialogProps) {
  const [open, setOpen] = useState(false)
  const [images, setImages] = useState<WhatsappMediaListItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<WhatsappMediaListItem | null>(null)

  const loadImages = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await portalFetch('/api/portal/admin/whatsapp-media')
      const data = (await res?.json().catch(() => null)) as ImagesResponse | null
      if (!res?.ok || data?.ok !== true) {
        throw new Error(data?.error || 'Não foi possível carregar as imagens.')
      }
      setImages(data.images ?? [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar imagens.'
      toast({ variant: 'destructive', title: 'Erro', description: message })
      setImages([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    void loadImages()
  }, [open, loadImages])

  async function handleDelete (image: WhatsappMediaListItem) {
    if (deletingId) return
    setDeletingId(image.messageId)
    try {
      const res = await portalFetch(
        `/api/portal/admin/whatsapp-media/${image.messageId}`,
        { method: 'DELETE' },
      )
      const data = (await res?.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!res?.ok || data?.ok !== true) {
        throw new Error(data?.error || 'Não foi possível excluir a imagem.')
      }

      setImages((current) => current.filter((item) => item.messageId !== image.messageId))
      toast({ title: 'Imagem excluída', description: 'A imagem foi removida do storage.' })
      await onImagesChanged?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir imagem.'
      toast({ variant: 'destructive', title: 'Erro', description: message })
    } finally {
      setDeletingId(null)
      setPendingDelete(null)
    }
  }

  const totalBytes = images.reduce((sum, image) => sum + image.sizeBytes, 0)

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline">
            <Images className="mr-2 h-4 w-4" aria-hidden />
            Ver imagens
          </Button>
        </DialogTrigger>
        <DialogContent className="flex max-h-[min(92vh,900px)] w-[min(96vw,1100px)] max-w-[min(96vw,1100px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,1100px)]">
          <DialogHeader className="space-y-1 border-b px-6 py-4 text-left">
            <DialogTitle>Imagens do WhatsApp</DialogTitle>
            <DialogDescription>
              Armazenadas no portal (expiram em ~24 h). Ordenadas por tamanho. Total:{' '}
              {images.length} imagem(ns)
              {totalBytes > 0 ? ` · ${formatMediaSizeBytes(totalBytes)}` : ''}.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
            {isLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Carregando imagens…
              </p>
            ) : images.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma imagem armazenada no momento.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[72px]">Imagem</TableHead>
                    <TableHead>Conversa</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Tamanho</TableHead>
                    <TableHead className="w-[120px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {images.map((image) => {
                    const isDeleting = deletingId === image.messageId

                    return (
                      <TableRow key={image.messageId}>
                        <TableCell>
                          {image.url ? (
                            <a
                              href={image.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block h-12 w-12 overflow-hidden rounded-md border bg-muted"
                            >
                              <Image
                                src={image.url}
                                alt=""
                                width={48}
                                height={48}
                                className="h-full w-full object-cover"
                                unoptimized
                              />
                            </a>
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground">
                              —
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{image.conversationLabel}</span>
                        </TableCell>
                        <TableCell>{formatImageDate(image.createdAt)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatMediaSizeBytes(image.sizeBytes)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {image.url ? (
                              <Button type="button" variant="ghost" size="icon" asChild>
                                <a
                                  href={image.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label="Abrir imagem em nova aba"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              disabled={isDeleting}
                              aria-label="Excluir imagem"
                              onClick={() => setPendingDelete(image)}
                            >
                              {isDeleting ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                              ) : (
                                <Trash2 className="h-4 w-4" aria-hidden />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta imagem?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `A imagem da conversa com ${pendingDelete.conversationLabel} (${formatMediaSizeBytes(pendingDelete.sizeBytes)}) será removida do storage. A mensagem permanece no histórico.`
                : 'Esta ação não pode ser desfeita.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingId !== null}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingId !== null || pendingDelete === null}
              onClick={(event) => {
                event.preventDefault()
                if (pendingDelete) void handleDelete(pendingDelete)
              }}
            >
              Excluir imagem
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
