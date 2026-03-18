'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'

export function ImportFromBlingButton () {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick () {
    if (loading) return
    setLoading(true)
    try {
      let page = 1
      const limit = 100
      let totalImported = 0
      let totalUpdated = 0

      // loop até não haver mais itens (imported + updated == 0)
      while (true) {
        const res = await fetch('/api/portal/bling/import-products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ page, limit }),
        })
        const data = await res.json().catch(() => null)

        if (!res.ok || !data?.ok) {
          toast({
            variant: 'destructive',
            title: 'Erro ao importar do Bling',
            description: data?.message || data?.error || `Falha na página ${page}.`,
          })
          break
        }

        const imported = Number(data.imported ?? 0)
        const updated = Number(data.updated ?? 0)
        totalImported += imported
        totalUpdated += updated

        if (imported === 0 && updated === 0) {
          break
        }

        page += 1
      }

      toast({
        variant: 'success',
        title: 'Importação concluída',
        description: `Importados ${totalImported}, atualizados ${totalUpdated}.`,
      })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={loading}>
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Importando...
        </>
      ) : (
        'Importar do Bling'
      )}
    </Button>
  )
}

