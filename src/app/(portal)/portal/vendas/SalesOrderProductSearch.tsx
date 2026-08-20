'use client'

import { useEffect, useId, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { maskedFromCents } from '@/lib/utils/money'

export type SalesOrderCatalogHit = {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  sale_price_cents: number | null
  cost_price_cents: number | null
}

export function SalesOrderProductSearch ({
  onPick,
  disabled,
}: {
  onPick: (product: SalesOrderCatalogHit) => void
  disabled?: boolean
}) {
  const inputId = useId()
  const listId = useId()
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SalesOrderCatalogHit[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setHits([])
      setIsSearching(false)
      return
    }

    const ac = new AbortController()
    const timer = window.setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await portalFetch(
          `/api/portal/pdv/catalog?q=${encodeURIComponent(q)}`,
          { signal: ac.signal },
        )
        const data = await res?.json().catch(() => null)
        if (ac.signal.aborted) return
        const products = Array.isArray(data?.products) ? data.products as SalesOrderCatalogHit[] : []
        setHits(products)
        setIsOpen(true)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setHits([])
      } finally {
        if (!ac.signal.aborted) setIsSearching(false)
      }
    }, 250)

    return () => {
      window.clearTimeout(timer)
      ac.abort()
    }
  }, [query])

  function pick (product: SalesOrderCatalogHit) {
    onPick(product)
    setQuery('')
    setHits([])
    setIsOpen(false)
  }

  const showList = isOpen && query.trim().length >= 2

  return (
    <div className='relative space-y-1.5'>
      <Label htmlFor={inputId}>Adicionar produto</Label>
      <Input
        id={inputId}
        type='search'
        autoComplete='off'
        disabled={disabled}
        value={query}
        placeholder='Nome, SKU ou código de barras'
        aria-autocomplete='list'
        aria-controls={listId}
        aria-expanded={showList}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          if (hits.length > 0) setIsOpen(true)
        }}
        onBlur={() => {
          window.setTimeout(() => setIsOpen(false), 120)
        }}
      />
      {showList ? (
        <ul
          id={listId}
          role='listbox'
          className='absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 text-sm shadow-md'
        >
          {isSearching && hits.length === 0 ? (
            <li className='px-3 py-2 text-muted-foreground'>Buscando…</li>
          ) : hits.length === 0 ? (
            <li className='px-3 py-2 text-muted-foreground'>Nenhum produto encontrado.</li>
          ) : hits.map((product) => (
            <li key={product.id} role='option'>
              <button
                type='button'
                className='flex w-full items-start justify-between gap-3 rounded-sm px-3 py-2 text-left hover:bg-accent'
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(product)}
              >
                <span className='min-w-0'>
                  <span className='block font-medium'>{product.name}</span>
                  {product.sku ? (
                    <span className='block text-xs text-muted-foreground'>{product.sku}</span>
                  ) : null}
                </span>
                <span className='shrink-0 tabular-nums'>
                  {maskedFromCents(Math.max(0, Number(product.sale_price_cents) || 0))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
