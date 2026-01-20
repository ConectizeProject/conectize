'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function ClearServicosFiltersButton (props: { className?: string }) {
  const [isClearing, setIsClearing] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const handleClear = async () => {
    const startAt = Date.now()
    setIsClearing(true)

    try {
      router.push(pathname || '/servicos')
    } finally {
      const elapsedMs = Date.now() - startAt
      const remainingMs = Math.max(0, 1000 - elapsedMs)
      if (remainingMs > 0) await new Promise(resolve => setTimeout(resolve, remainingMs))
      setIsClearing(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClear}
      disabled={isClearing}
      className={props.className}
    >
      {isClearing ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Limpando...
        </span>
      ) : (
        'Limpar filtros'
      )}
    </Button>
  )
}

