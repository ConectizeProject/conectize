'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'

export function BackfillFromBlingButton () {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  async function handleClick () {
    if (loading) return
    setLoading(true)
    setStatus('Iniciando atualização em lote...')

    try {
      let offset = 0
      const limit = 100
      let totalProcessed = 0
      let totalUpdated = 0

      // Roda lotes em sequência até o endpoint indicar que terminou
      // ou até não processar mais nada.
      // Evita loop infinito respeitando um teto de 10k itens por clique.
      const maxIterations = 100
      let iterations = 0

       
      while (true) {
        if (iterations >= maxIterations) break
        iterations += 1

        setStatus(`Processando lote a partir de offset ${offset}...`)

        const res = await fetch('/api/portal/bling/backfill-products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit, offset }),
        })

        const data = await res.json().catch(() => null) as {
          ok?: boolean
          processed?: number
          updated?: number
          nextOffset?: number
          finished?: boolean
          message?: string
          error?: string
        } | null

        if (!res.ok || !data?.ok) {
          toast({
            variant: 'destructive',
            title: 'Erro ao atualizar produtos pelo Bling',
            description: data?.message || data?.error || 'Tente novamente.',
          })
          break
        }

        const processed = Number(data.processed ?? 0)
        const updated = Number(data.updated ?? 0)
        totalProcessed += processed
        totalUpdated += updated

        setStatus(`Processados ${totalProcessed} itens, atualizados ${totalUpdated}.`)

        if (data.finished || processed === 0 || !Number.isFinite(processed)) {
          break
        }

        offset = Number(data.nextOffset ?? (offset + processed))
        if (!Number.isFinite(offset) || offset < 0) {
          break
        }
      }

      toast({
        variant: 'success',
        title: 'Atualização em lote concluída',
        description: `Total processado: ${totalProcessed}, atualizados: ${totalUpdated}.`,
      })

      router.refresh()
    } finally {
      setLoading(false)
      setStatus(null)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Atualizando em lote...
          </>
        ) : (
          'Atualizar em lote pelo Bling'
        )}
      </Button>
      {status && (
        <span className="text-[11px] text-muted-foreground">
          {status}
        </span>
      )}
    </div>
  )
}

