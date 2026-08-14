'use client'

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PhotoPreviewImg, PhotoFullImg } from '@/components/media/photo-preview-img'
import { useCallback, useEffect, useState } from 'react'

export type OsPublicPhotoItem = {
  id: string
  url: string | null
  thumbUrl?: string | null
  created_at: string
}

type OsPublicEntryPhotosProps = {
  photos: OsPublicPhotoItem[]
  className?: string
  title?: string
}

export function OsPublicEntryPhotos ({
  photos,
  className,
  title = 'Fotos do aparelho no momento da entrada',
}: OsPublicEntryPhotosProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const openModal = useCallback((index: number) => {
    setSelectedIndex(index)
    setModalOpen(true)
  }, [])

  const total = photos.length
  const canPrev = total > 1 && selectedIndex > 0
  const canNext = total > 1 && selectedIndex < total - 1
  const goPrev = useCallback(() => {
    if (canPrev) setSelectedIndex((i) => i - 1)
  }, [canPrev])
  const goNext = useCallback(() => {
    if (canNext) setSelectedIndex((i) => i + 1)
  }, [canNext])

  useEffect(() => {
    if (!modalOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modalOpen, goPrev, goNext])

  if (photos.length === 0) return null

  const current = photos[selectedIndex]

  return (
    <>
      <div className={cn('space-y-3', className)}>
        <h3 className="text-sm font-medium">{title}</h3>
        <ul className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
          {photos.map((photo, index) => (
            <li key={photo.id} className="list-none">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  openModal(index)
                }}
                className="relative block w-full aspect-square rounded-lg border border-border bg-muted overflow-hidden hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
                aria-label="Ver foto em tamanho maior"
              >
                {photo.url || photo.thumbUrl ? (
                  <PhotoPreviewImg previewSrc={photo.thumbUrl} fullSrc={photo.url} />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs pointer-events-none">
                    —
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent
          className="max-w-[95vw] w-full max-h-[95vh] p-2 sm:p-6 flex flex-col items-center justify-center gap-2"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">
            Foto do aparelho {total > 1 ? `— ${selectedIndex + 1} de ${total}` : ''}
          </DialogTitle>
          <div className="relative flex items-center justify-center gap-2 w-full flex-1 min-h-0">
            {total > 1 && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0 h-10 w-10 rounded-full"
                onClick={goPrev}
                disabled={!canPrev}
                aria-label="Foto anterior"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
            )}
            <div className="relative w-full h-[70vh] min-h-[200px] max-w-4xl mx-auto flex items-center justify-center">
              {current?.url || current?.thumbUrl ? (
                <PhotoFullImg
                  src={current.url}
                  fallbackSrc={current.thumbUrl}
                  alt={`Foto ${selectedIndex + 1} de ${total}`}
                />
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
            {total > 1 && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0 h-10 w-10 rounded-full"
                onClick={goNext}
                disabled={!canNext}
                aria-label="Próxima foto"
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            )}
          </div>
          {total > 1 && (
            <p className="text-sm text-muted-foreground">
              {selectedIndex + 1} / {total}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
