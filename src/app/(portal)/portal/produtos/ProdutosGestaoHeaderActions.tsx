'use client'

import { Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useProdutosGestaoHeaderHandlers } from './ProdutosGestaoActionsContext'

export function ProdutosGestaoHeaderActions () {
  const handlers = useProdutosGestaoHeaderHandlers()
  const disabled = !handlers

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="sm:h-9"
        disabled={disabled}
        onClick={() => handlers?.openAssistenciaLinks()}
      >
        <Link2 className="mr-1.5 h-3.5 w-3.5" />
        Sugestões de vínculo
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="sm:h-9"
        disabled={disabled}
        onClick={() => handlers?.openCreateProduct()}
      >
        Novo produto/serviço
      </Button>
    </div>
  )
}
