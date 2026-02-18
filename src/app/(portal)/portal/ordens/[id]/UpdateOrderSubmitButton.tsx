'use client'

import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = { disabled?: boolean }

export function UpdateOrderSubmitButton({ disabled = false }: Props) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando
        </span>
      ) : (
        'Salvar'
      )}
    </Button>
  )
}
