'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

type PreviewProps = {
  previewSrc: string | null | undefined
  fullSrc?: string | null
  alt?: string
  className?: string
}

export function PhotoPreviewImg ({
  previewSrc,
  fullSrc,
  alt = '',
  className,
}: PreviewProps) {
  const preview = previewSrc || ''
  const fallback = fullSrc || ''
  const [src, setSrc] = useState(preview || fallback)

  useEffect(() => {
    setSrc(preview || fallback)
  }, [preview, fallback])

  if (!src) return null

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      draggable={false}
      referrerPolicy="no-referrer"
      className={cn('absolute inset-0 size-full object-cover pointer-events-none', className)}
      onError={() => {
        if (fallback && src !== fallback) setSrc(fallback)
      }}
    />
  )
}

type FullProps = {
  src: string | null | undefined
  fallbackSrc?: string | null
  alt?: string
  className?: string
}

export function PhotoFullImg ({
  src,
  fallbackSrc,
  alt = '',
  className,
}: FullProps) {
  const primary = src || ''
  const fallback = fallbackSrc || ''
  const [current, setCurrent] = useState(primary || fallback)

  useEffect(() => {
    setCurrent(primary || fallback)
  }, [primary, fallback])

  if (!current) return null

  return (
    <img
      src={current}
      alt={alt}
      loading="eager"
      decoding="async"
      referrerPolicy="no-referrer"
      className={cn('max-h-full max-w-full w-auto h-auto object-contain', className)}
      onError={() => {
        if (fallback && current !== fallback) setCurrent(fallback)
      }}
    />
  )
}
