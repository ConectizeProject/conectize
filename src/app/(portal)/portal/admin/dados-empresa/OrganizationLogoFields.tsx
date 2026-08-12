'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const LOGO_ACCEPT = 'image/jpeg,image/png,image/webp,image/svg+xml'
const LOGO_MAX_BYTES = 2 * 1024 * 1024

type Props = {
  initialLogoUrl?: string | null
}

export function OrganizationLogoFields ({ initialLogoUrl }: Props) {
  const [logoUrl, setLogoUrl] = useState(String(initialLogoUrl || ''))
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  useEffect(() => {
    if (!logoFile) {
      setPreviewUrl(null)
      return
    }

    const objectUrl = URL.createObjectURL(logoFile)
    setPreviewUrl(objectUrl)
    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [logoFile])

  function onFileChange (fileList: FileList | null) {
    setFileError(null)
    const file = fileList?.[0] || null
    if (!file) {
      setLogoFile(null)
      return
    }

    if (file.size > LOGO_MAX_BYTES) {
      setLogoFile(null)
      setFileError('A imagem deve ter no máximo 2 MB.')
      return
    }

    const allowed = LOGO_ACCEPT.split(',')
    if (file.type && !allowed.includes(file.type)) {
      setLogoFile(null)
      setFileError('Use JPG, PNG, WebP ou SVG.')
      return
    }

    setLogoFile(file)
  }

  const shownPreview = previewUrl || (logoUrl ? logoUrl : null)

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="space-y-1">
        <Label htmlFor="logoFile">Logo</Label>
        <p className="text-xs text-muted-foreground">
          Envie uma imagem (até 2 MB) ou informe uma URL. Se enviar arquivo, ele substitui a URL.
        </p>
      </div>

      <Input
        id="logoFile"
        name="logoFile"
        type="file"
        accept={LOGO_ACCEPT}
        onChange={(event) => {
          onFileChange(event.target.files)
        }}
      />

      {fileError ? (
        <p className="text-sm text-destructive">{fileError}</p>
      ) : null}

      {shownPreview ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shownPreview}
            alt="Prévia do logo"
            className="h-14 w-14 rounded-md border object-contain bg-background"
          />
          {logoFile ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setLogoFile(null)
                setFileError(null)
              }}
            >
              Remover imagem
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="logoUrl">Ou URL do logo</Label>
        <Input
          id="logoUrl"
          name="logoUrl"
          type="url"
          placeholder="/logo_conectize.svg ou URL completa"
          disabled={Boolean(logoFile)}
          value={logoUrl}
          onChange={(event) => {
            setLogoUrl(event.target.value)
          }}
        />
      </div>
    </div>
  )
}
