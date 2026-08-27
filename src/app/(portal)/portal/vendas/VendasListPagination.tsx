'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  page: number
  pageSize: number
  total: number
  disabled?: boolean
  onPageChange: (page: number) => void
}

export function VendasListPagination ({
  page,
  pageSize,
  total,
  disabled,
  onPageChange,
}: Props) {
  if (total <= 0) return null

  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(page, pageCount)
  const from = (current - 1) * pageSize + 1
  const to = Math.min(total, current * pageSize)
  const hasPrev = current > 1
  const hasNext = current < pageCount

  return (
    <div className='flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between'>
      <p className='text-xs text-muted-foreground'>
        {from}–{to} de {total}
        {pageCount > 1 ? ` · página ${current} de ${pageCount}` : ''}
      </p>
      {pageCount > 1 ? (
        <div className='flex items-center gap-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={disabled || !hasPrev}
            onClick={() => onPageChange(current - 1)}
          >
            <ChevronLeft className='mr-1 h-4 w-4' />
            Anterior
          </Button>
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={disabled || !hasNext}
            onClick={() => onPageChange(current + 1)}
          >
            Próxima
            <ChevronRight className='ml-1 h-4 w-4' />
          </Button>
        </div>
      ) : null}
    </div>
  )
}
