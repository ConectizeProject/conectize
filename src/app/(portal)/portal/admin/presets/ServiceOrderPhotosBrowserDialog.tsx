'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
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
import { formatBytes } from '@/lib/utils/format-bytes'
import {
  type ServiceOrderPhotoKind,
  type ServiceOrderPhotoListItem,
} from '@/lib/orders/service-order-photos-admin'

type PhotosResponse = {
  ok?: boolean
  photos?: ServiceOrderPhotoListItem[]
  error?: string
}

type ServiceOrderPhotosBrowserDialogProps = {
  onPhotosChanged?: () => void | Promise<void>
}

function formatPhotoDate (iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('pt-BR')
}

function kindLabel (kind: ServiceOrderPhotoKind): string {
  if (kind === 'entry') return 'Entrada'
  if (kind === 'exit') return 'Saída'
  return 'Assistência'
}

export function ServiceOrderPhotosBrowserDialog ({
  onPhotosChanged,
}: ServiceOrderPhotosBrowserDialogProps) {
  const [open, setOpen] = useState(false)
  const [photos, setPhotos] = useState<ServiceOrderPhotoListItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ServiceOrderPhotoListItem | null>(null)

  const loadPhotos = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await portalFetch('/api/portal/admin/service-order-photos')
      const data = (await res?.json().catch(() => null)) as PhotosResponse | null
      if (!res?.ok || data?.ok !== true) {
        throw new Error(data?.error || 'Não foi possível carregar as fotos.')
      }
      setPhotos(data.photos ?? [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar fotos.'
      toast({ variant: 'destructive', title: 'Erro', description: message })
      setPhotos([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    void loadPhotos()
  }, [open, loadPhotos])

  async function handleDelete (photo: ServiceOrderPhotoListItem) {
    if (deletingId) return
    setDeletingId(photo.id)
    try {
      const res = await portalFetch(
        `/api/portal/admin/service-order-photos/${photo.id}?kind=${photo.kind}`,
        { method: 'DELETE' },
      )
      const data = (await res?.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!res?.ok || data?.ok !== true) {
        throw new Error(data?.error || 'Não foi possível excluir a foto.')
      }

      setPhotos((current) => current.filter((item) => item.id !== photo.id))
      toast({ title: 'Foto excluída', description: 'A foto foi removida do storage e do banco.' })
      await onPhotosChanged?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir foto.'
      toast({ variant: 'destructive', title: 'Erro', description: message })
    } finally {
      setDeletingId(null)
      setPendingDelete(null)
    }
  }

  const totalBytes = photos.reduce((sum, photo) => sum + (photo.sizeBytes ?? 0), 0)

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline">
            <Images className="mr-2 h-4 w-4" aria-hidden />
            Ver fotos
          </Button>
        </DialogTrigger>
        <DialogContent className="flex max-h-[min(92vh,900px)] w-[min(96vw,1100px)] max-w-[min(96vw,1100px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,1100px)]">
          <DialogHeader className="space-y-1 border-b px-6 py-4 text-left">
            <DialogTitle>Fotos de ordens de serviço</DialogTitle>
            <DialogDescription>
              Listadas por tamanho (maior primeiro). Total: {photos.length} foto(s)
              {totalBytes > 0 ? ` · ${formatBytes(totalBytes)}` : ''}.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
            {isLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Carregando fotos…
              </p>
            ) : photos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma foto encontrada.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[72px]">Foto</TableHead>
                    <TableHead>OS</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Tamanho</TableHead>
                    <TableHead className="w-[120px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {photos.map((photo) => {
                    const orderHref = photo.orderNumber
                      ? `/portal/ordens/${encodeURIComponent(photo.orderNumber)}`
                      : null
                    const isDeleting = deletingId === photo.id

                    return (
                      <TableRow key={`${photo.kind}-${photo.id}`}>
                        <TableCell>
                          {photo.url ? (
                            <a
                              href={photo.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block h-12 w-12 overflow-hidden rounded-md border bg-muted"
                            >
                              <Image
                                src={photo.url}
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
                          {orderHref ? (
                            <Link href={orderHref} className="font-medium hover:underline">
                              #{photo.orderNumber}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>{kindLabel(photo.kind)}</TableCell>
                        <TableCell>{formatPhotoDate(photo.createdAt)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatBytes(photo.sizeBytes)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {photo.url ? (
                              <Button type="button" variant="ghost" size="icon" asChild>
                                <a
                                  href={photo.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label="Abrir foto em nova aba"
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
                              aria-label="Excluir foto"
                              onClick={() => setPendingDelete(photo)}
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
            <AlertDialogTitle>Excluir esta foto?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `A foto de ${kindLabel(pendingDelete.kind).toLowerCase()} da OS ${pendingDelete.orderNumber ? `#${pendingDelete.orderNumber}` : 'sem número'} (${formatBytes(pendingDelete.sizeBytes)}) será removida permanentemente.`
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
              Excluir foto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
