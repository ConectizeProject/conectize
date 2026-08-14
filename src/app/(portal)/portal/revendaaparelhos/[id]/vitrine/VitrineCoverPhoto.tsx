'use client'

import { ResaleCoverPhotoPreview } from '@/components/resale/ResaleCoverPhotoPreview'

type Props = {
  thumbUrl: string | null
  fullUrl: string | null
}

export function VitrineCoverPhoto ({ thumbUrl, fullUrl }: Props) {
  return (
    <ResaleCoverPhotoPreview
      thumbUrl={thumbUrl}
      fullUrl={fullUrl}
      className="transition-transform duration-200 hover:scale-[1.02]"
    />
  )
}
