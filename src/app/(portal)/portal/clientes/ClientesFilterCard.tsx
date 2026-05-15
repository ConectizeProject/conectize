'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'

type Props = {
  initialQ: string
  initialDocumentDigits: string
}

function clientesHref (
  q: string,
  documentDigits: string,
  omit: ReadonlySet<'q' | 'document'>,
): string {
  const p = new URLSearchParams()
  if (!omit.has('q') && q.trim()) p.set('q', q.trim())
  if (!omit.has('document') && documentDigits.trim()) {
    p.set('document', documentDigits.replace(/\D/g, ''))
  }
  const qs = p.toString()
  return qs ? `/portal/clientes?${qs}` : '/portal/clientes'
}

export function ClientesFilterCard ({ initialQ, initialDocumentDigits }: Props) {
  const router = useRouter()
  const [qInput, setQInput] = useState(initialQ)
  const [documentDigits, setDocumentDigits] = useState(initialDocumentDigits)
  const [documentMasked, setDocumentMasked] = useState(
    formatCpfCnpj(initialDocumentDigits),
  )

  useEffect(() => {
    setQInput(initialQ)
  }, [initialQ])

  useEffect(() => {
    setDocumentDigits(initialDocumentDigits)
    setDocumentMasked(formatCpfCnpj(initialDocumentDigits))
  }, [initialDocumentDigits])

  const handleClearQ = useCallback(() => {
    router.push(clientesHref(qInput, documentDigits, new Set(['q'])))
  }, [router, qInput, documentDigits])

  const handleClearDocument = useCallback(() => {
    router.push(clientesHref(qInput, documentDigits, new Set(['document'])))
  }, [router, qInput, documentDigits])

  const appliedExtraLabels = useMemo(() => {
    const rows: { id: string; text: string }[] = []
    const d = documentDigits.replace(/\D/g, '')
    if (d) {
      rows.push({
        id: 'doc',
        text: `Documento: ${formatCpfCnpj(d)}`,
      })
    }
    return rows
  }, [documentDigits])

  const showExtrasRow = appliedExtraLabels.length > 0

  return (
    <form action="/portal/clientes" method="get" className="grid gap-4 md:grid-cols-3">
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="q">Nome / e-mail</Label>
        <div className="relative">
          <Input
            id="q"
            name="q"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Ex: Maria, cliente@exemplo.com"
            className={qInput.trim() ? 'pr-10' : undefined}
          />
          {qInput.trim() ? (
            <button
              type="button"
              onClick={handleClearQ}
              className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Limpar busca por nome ou e-mail"
              title="Limpar busca"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="document">CPF/CNPJ</Label>
        <div className="relative">
          <Input
            id="document"
            name="document"
            value={documentMasked}
            onChange={(e) => {
              const masked = formatCpfCnpj(e.target.value)
              setDocumentMasked(masked)
              setDocumentDigits(masked.replace(/\D/g, ''))
            }}
            placeholder="000.000.000-00"
            inputMode="numeric"
            autoComplete="off"
            className={documentDigits.trim() ? 'pr-10' : undefined}
          />
          {documentDigits.trim() ? (
            <button
              type="button"
              onClick={handleClearDocument}
              className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Limpar documento"
              title="Limpar documento"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      {showExtrasRow ? (
        <div className="md:col-span-3 flex flex-wrap items-center gap-2 border-t border-border/50 pt-2 text-[11px] leading-snug sm:text-xs">
          <span className="mr-0.5 shrink-0 font-medium text-foreground/80">
            Filtros extras:
          </span>
          {appliedExtraLabels.map((chip) => (
            <span
              key={chip.id}
              className="max-w-full truncate rounded-md bg-muted/70 px-2 py-0.5 text-muted-foreground"
              title={chip.text}
            >
              {chip.text}
            </span>
          ))}
          <Link
            href="/portal/clientes"
            className="ml-auto shrink-0 font-medium text-primary underline-offset-2 hover:underline"
          >
            Limpar todos
          </Link>
        </div>
      ) : null}

      <div className="md:col-span-3 flex flex-wrap items-center gap-3">
        <Button type="submit">Buscar</Button>
        <Button variant="outline" asChild>
          <Link href="/portal/clientes">Limpar</Link>
        </Button>
      </div>
    </form>
  )
}
