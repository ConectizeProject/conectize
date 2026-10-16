'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Product } from '@/lib/products/service'
import { ProductFormDialog } from '@/app/(portal)/portal/produtos/ProductFormDialog'

export type ProductEditTab = 'dados' | 'variacoes' | 'estoque'

export type ProductEditTarget = {
  id: string
  name?: string
  initialEditTab?: ProductEditTab
}

export type UseProductEditDialogOptions = {
  onSuccess?: (product?: Product) => void
  onStockChange?: (productId: string, currentStock: number) => void
  blingHubConnected?: boolean
}

/**
 * Controla a modal reutilizável de edição de produto (gestão de estoque / produtos).
 * Use em qualquer listagem do portal sem reimplementar o Dialog.
 */
export function useProductEditDialog (options: UseProductEditDialogOptions = {}) {
  const [target, setTarget] = useState<ProductEditTarget | null>(null)
  const onSuccessRef = useRef(options.onSuccess)
  const onStockChangeRef = useRef(options.onStockChange)
  const blingHubConnected = Boolean(options.blingHubConnected)

  useEffect(() => {
    onSuccessRef.current = options.onSuccess
  }, [options.onSuccess])

  useEffect(() => {
    onStockChangeRef.current = options.onStockChange
  }, [options.onStockChange])

  const open = useCallback((next: ProductEditTarget) => {
    const id = String(next.id || '').trim()
    if (!id) return
    setTarget({
      id,
      name: next.name,
      initialEditTab: next.initialEditTab,
    })
  }, [])

  const close = useCallback(() => {
    setTarget(null)
  }, [])

  const dialog = (
    <ProductFormDialog
      open={Boolean(target)}
      mode='edit'
      productId={target?.id ?? null}
      initialName={target?.name}
      initialEditTab={target?.initialEditTab}
      blingHubConnected={blingHubConnected}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) close()
      }}
      onSuccess={(product) => {
        onSuccessRef.current?.(product)
      }}
      onStockChange={(productId, currentStock) => {
        onStockChangeRef.current?.(productId, currentStock)
      }}
      onNavigateToProductId={(id) => {
        setTarget((prev) => ({
          id,
          name: '',
          initialEditTab: prev?.initialEditTab,
        }))
      }}
    />
  )

  return {
    open,
    close,
    dialog,
    target,
    isOpen: Boolean(target),
  }
}
