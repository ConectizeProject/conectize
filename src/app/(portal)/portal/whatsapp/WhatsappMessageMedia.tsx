'use client'

import { FileText, ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { readWhatsappMessageMedia } from '@/lib/whatsapp/whatsapp-media-types'
import { waMessageBodyClassName } from './whatsapp-inbox-utils'

type Props = {
  body: string | null
  payload?: Record<string, unknown>
  mediaUrl: string | null
  mediaExpired: boolean
  isDeleted?: boolean
}

export function WhatsappMessageMedia ({
  body,
  payload,
  mediaUrl,
  mediaExpired,
  isDeleted = false,
}: Props) {
  const media = readWhatsappMessageMedia(payload)
  const label = body?.trim() || media?.type || 'Mídia'

  if (media?.download_error && !mediaUrl) {
    return (
      <p className="text-xs text-muted-foreground">
        Não foi possível baixar a mídia.
        <span className="mt-1 block font-mono text-[10px] opacity-80">
          {media.download_error}
        </span>
      </p>
    )
  }

  if (mediaExpired || (media && !mediaUrl)) {
    return (
      <p className="text-xs italic text-muted-foreground">
        Mídia expirada (disponível por 24 h no portal).
      </p>
    )
  }

  if (!mediaUrl || !media) {
    return body ? (
      <p className={waMessageBodyClassName(body)}>{body}</p>
    ) : (
      <p className="text-muted-foreground">—</p>
    )
  }

  const mime = media.mime_type.toLowerCase()

  return (
    <div
      className={
        isDeleted ? 'space-y-2 line-through decoration-destructive/80' : 'space-y-2'
      }
    >
      {mime.startsWith('image/') || media.type === 'sticker' ? (
        <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl}
            alt={media.file_name || label}
            className="max-h-64 max-w-full rounded-md object-contain"
          />
        </a>
      ) : null}
      {mime.startsWith('video/') ? (
        <video
          src={mediaUrl}
          controls
          className="max-h-64 max-w-full rounded-md"
          preload="metadata"
        />
      ) : null}
      {mime.startsWith('audio/') ? (
        <audio src={mediaUrl} controls className="w-full max-w-sm" preload="metadata" />
      ) : null}
      {media.type === 'document' || (!mime.startsWith('image/') && !mime.startsWith('video/') && !mime.startsWith('audio/')) ? (
        <a
          href={mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border border-current/20 px-2 py-1 text-xs underline"
        >
          <FileText className="h-4 w-4 shrink-0" />
          {media.file_name || 'Baixar arquivo'}
        </a>
      ) : null}
      {body && !body.startsWith('[') ? (
        <p className={cn(waMessageBodyClassName(body), 'opacity-90')}>{body}</p>
      ) : null}
      {!mime.startsWith('image/') && media.type !== 'sticker' && !body ? (
        <span className="inline-flex items-center gap-1 text-xs opacity-70">
          <ImageIcon className="h-3 w-3" />
          {label}
        </span>
      ) : null}
    </div>
  )
}
