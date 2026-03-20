'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'

type Props = { productId: string; hasBling: boolean }

export function ProductDetailActions ({ productId, hasBling }: Props) {
  const router = useRouter()
  const [loadingProduct, setLoadingProduct] = useState(false)
  const [loadingStock, setLoadingStock] = useState(false)

  if (!hasBling) return null

  async function callEndpoint (url: string, setLoading: (v: boolean) => void, successMsg: string) {
    setLoading(true)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast({
          variant: 'destructive',
          title: 'Erro na sincronização',
          description: data?.message || data?.error || 'Tente novamente.',
        })
        return
      }
      if (data?.skipped === 'bling_no_stock_resource' && typeof data?.message === 'string') {
        toast({
          variant: 'default',
          title: 'Estoque no Bling',
          description: data.message,
        })
        router.refresh()
        return
      }
      toast({ variant: 'success', title: successMsg })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex gap-2 flex-wrap">
      <Button
        variant="outline"
        size="sm"
        disabled={loadingProduct}
        onClick={() => callEndpoint('/api/portal/bling/sync-product', setLoadingProduct, 'Dados atualizados pelo Bling.')}
      >
        {loadingProduct ? 'Atualizando...' : 'Atualizar dados pelo Bling'}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={loadingStock}
        onClick={() => callEndpoint('/api/portal/bling/sync-stock', setLoadingStock, 'Estoque sincronizado com Bling.')}
      >
        {loadingStock ? 'Sincronizando...' : 'Sincronizar estoque com Bling'}
      </Button>
    </div>
  )
}

