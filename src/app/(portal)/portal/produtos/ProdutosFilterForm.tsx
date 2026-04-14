'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ProdutosFilterFormProps = {
  initialQ: string
  kind: 'product' | 'service'
  /** Mantém `?tab=gestao` ao filtrar na área staff (abas de produtos). */
  withGestaoTab?: boolean
}

export function ProdutosFilterForm ({ initialQ, kind, withGestaoTab }: ProdutosFilterFormProps) {
  const router = useRouter()
  const [value, setValue] = useState(initialQ)

  useEffect(() => {
    setValue(initialQ)
  }, [initialQ])

  function handleSubmit (e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const q = value.trim()
    const params = new URLSearchParams()
    if (withGestaoTab) params.set('tab', 'gestao')
    if (kind === 'service') params.set('kind', 'service')
    if (q) params.set('q', q)
    const qs = params.toString()
    const href = qs ? `/portal/produtos?${qs}` : (withGestaoTab ? '/portal/produtos?tab=gestao' : '/portal/produtos')
    router.replace(href)
    router.refresh()
  }

  function handleClear () {
    setValue('')
    const clearParams = new URLSearchParams()
    if (withGestaoTab) clearParams.set('tab', 'gestao')
    if (kind === 'service') clearParams.set('kind', 'service')
    const clearQs = clearParams.toString()
    router.replace(clearQs ? `/portal/produtos?${clearQs}` : (withGestaoTab ? '/portal/produtos?tab=gestao' : '/portal/produtos'))
    router.refresh()
  }

  const hasValue = value.trim().length > 0

  return (
    <form onSubmit={handleSubmit} className="flex w-full items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <input
          name="q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Nome, SKU ou código — use várias palavras"
          aria-label="Filtrar por nome, SKU ou código (várias palavras)"
          autoComplete="off"
          className="flex h-9 w-full rounded-md border border-input bg-background py-1 pl-3 pr-9 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
        {hasValue ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-1 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Limpar filtro"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <Button type="submit" className="shrink-0">
        Filtrar
      </Button>
    </form>
  )
}
