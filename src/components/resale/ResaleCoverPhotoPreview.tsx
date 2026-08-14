'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { PhotoFullImg, PhotoPreviewImg } from '@/components/media/photo-preview-img'
import { cn } from '@/lib/utils'

type Props = {
  thumbUrl: string | null | undefined
  fullUrl?: string | null
  alt?: string
  className?: string
}

export function ResaleCoverPhotoPreview ({
  thumbUrl,
  fullUrl,
  alt = '',
  className,
}: Props) {
  const [open, setOpen] = useState(false)
  const preview = thumbUrl || fullUrl || null
  const full = fullUrl || thumbUrl || null
  if (!preview) return null

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
        }}
        className={cn(
          'absolute inset-0 block overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
        aria-label="Ver foto em tamanho maior"
      >
        <PhotoPreviewImg previewSrc={thumbUrl} fullSrc={fullUrl} alt={alt} />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-[95vw] w-full max-h-[95vh] p-2 sm:p-6 flex items-center justify-center"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">Foto do aparelho</DialogTitle>
          <div className="flex max-h-[85vh] w-full items-center justify-center">
            <PhotoFullImg src={full} fallbackSrc={thumbUrl} alt={alt} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
