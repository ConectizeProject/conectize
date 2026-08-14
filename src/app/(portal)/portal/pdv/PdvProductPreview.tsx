'use client'

import { useEffect, useState } from 'react'
import { Barcode, Hash, Package, Wrench } from 'lucide-react'
import { isSafeProductListImageUrl } from '@/app/(portal)/portal/produtos/product-list-shared'
import { maskedFromCents } from '@/lib/utils/money'
import { cn } from '@/lib/utils'
import type { CatalogProduct } from './pdv-types'
import { isCatalogService } from './pdv-helpers'

export function ProductThumbImage ({ src, alt, eager }: { src: string, alt: string, eager?: boolean }) {
  const [hasError, setHasError] = useState(false)

  if (hasError) {
    return (
      <div className='flex h-full w-full items-center justify-center bg-muted'>
        <Package className='h-5 w-5 text-muted-foreground/50' />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className='absolute inset-0 h-full w-full object-cover'
      loading={eager ? 'eager' : 'lazy'}
      decoding='async'
      referrerPolicy='no-referrer'
      onError={() => setHasError(true)}
    />
  )
}

export function ProductPreview ({ product }: { product: CatalogProduct | null }) {
  const [previewImageError, setPreviewImageError] = useState(false)

  useEffect(() => {
    setPreviewImageError(false)
  }, [product?.id])

  if (!product) {
    return (
      <div className='flex h-full min-h-0 flex-1 items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground'>
        Selecione um produto
      </div>
    )
  }

  const imageUrl = product.image_url && isSafeProductListImageUrl(product.image_url)
    ? product.image_url
    : null
  const isService = isCatalogService(product)
  const stockLow = !isService && product.stock <= 0
  const showPreviewImage = Boolean(imageUrl) && !previewImageError

  return (
    <div className='flex h-full min-h-0 flex-1 gap-2 overflow-hidden'>
      <div className='relative flex h-full min-h-0 w-2/3 shrink-0 items-center justify-center rounded-xl border border-border'>
        {showPreviewImage && imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name}
            className='h-full w-full object-contain p-3'
            loading='eager'
            decoding='async'
            referrerPolicy='no-referrer'
            onError={() => setPreviewImageError(true)}
          />
        ) : (
          <div className='flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-muted-foreground'>
            {isService
              ? <Wrench className='h-10 w-10 opacity-40' />
              : <Package className='h-10 w-10 opacity-40' />}
            <span className='text-xs'>{isService ? 'Serviço' : 'Sem foto'}</span>
          </div>
        )}
      </div>
      <div className='flex h-full min-h-0 w-1/3 min-w-0 flex-col gap-2'>
        <p className='line-clamp-3 text-xs font-medium leading-tight'>{product.name}</p>
        <p className='text-base font-semibold'>
          R$ {maskedFromCents(product.sale_price_cents || 0)}
        </p>
        <div className='mt-auto space-y-1'>
          {isService ? (
            <div className='flex items-center gap-1.5 rounded-md border border-border bg-white px-2 py-1 text-[10px]'>
              <Wrench className='h-3 w-3 shrink-0 text-muted-foreground' />
              <span className='min-w-0 truncate text-left font-medium'>Serviço</span>
            </div>
          ) : (
            <div className='flex items-center gap-1.5 rounded-md border border-border bg-white px-2 py-1 text-[10px]'>
              <Package className={cn('h-3 w-3 shrink-0', stockLow ? 'text-destructive' : 'text-muted-foreground')} />
              <span className={cn('min-w-0 truncate text-left font-medium', stockLow ? 'text-destructive' : 'text-foreground')}>
                {product.stock}
              </span>
            </div>
          )}
          <div className='flex items-center gap-1.5 rounded-md border border-border bg-white px-2 py-1 text-[10px]'>
            <Hash className='h-3 w-3 shrink-0 text-muted-foreground' />
            <span className='min-w-0 truncate text-left font-medium'>{product.sku || '—'}</span>
          </div>
          <div className='flex items-center gap-1.5 rounded-md border border-border bg-white px-2 py-1 text-[10px]'>
            <Barcode className='h-3 w-3 shrink-0 text-muted-foreground' />
            <span className='min-w-0 truncate text-left font-medium'>{product.barcode || '—'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
