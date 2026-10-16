'use client'

import { Loader2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { TableCell, TableRow } from '@/components/ui/table'

export function VendasListLoadingOverlay ({
  label = 'Carregando…',
}: {
  label?: string
}) {
  return (
    <div
      className='absolute inset-0 z-10 flex items-center justify-center bg-background/70'
      aria-hidden='true'
    >
      <p className='flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground shadow-sm'>
        <Loader2 className='h-4 w-4 animate-spin' aria-hidden='true' />
        {label}
      </p>
    </div>
  )
}

function SalesOrderListRowSkeleton ({ isLast = false }: { isLast?: boolean }) {
  return (
    <div
      className={`grid gap-4 px-4 py-4 lg:grid-cols-[minmax(13rem,0.9fr)_minmax(16rem,1.3fr)_minmax(11rem,0.85fr)_minmax(13rem,0.95fr)]${isLast ? '' : ' border-b'}`}
      aria-hidden='true'
    >
      <div className='min-w-0 space-y-2'>
        <div className='flex flex-wrap items-center gap-2'>
          <Skeleton className='h-5 w-28' />
          <Skeleton className='h-5 w-14 rounded-full' />
        </div>
        <Skeleton className='h-4 w-44' />
        <Skeleton className='h-4 w-36' />
        <Skeleton className='h-3 w-40' />
      </div>

      <div className='min-w-0 space-y-2'>
        <div className='flex items-start gap-2'>
          <Skeleton className='h-6 w-10 shrink-0' />
          <Skeleton className='h-4 w-52 max-w-full' />
        </div>
        <div className='flex min-w-0 gap-3'>
          <Skeleton className='h-24 w-24 shrink-0 rounded-md' />
          <div className='min-w-0 flex-1 space-y-2 pt-0.5'>
            <Skeleton className='h-3 w-32' />
            <Skeleton className='h-3 w-28' />
            <Skeleton className='h-4 w-40' />
            <Skeleton className='h-3 w-24' />
          </div>
        </div>
      </div>

      <div className='w-full min-w-[8.5rem] max-w-[11rem] space-y-1.5'>
        {Array.from({ length: 7 }, (_, index) => (
          <Skeleton key={index} className='h-4 w-full' />
        ))}
      </div>

      <div className='space-y-2'>
        <Skeleton className='h-9 w-full' />
        <Skeleton className='h-9 w-full' />
        <Skeleton className='ml-auto h-8 w-8' />
      </div>
    </div>
  )
}

export function SalesOrdersCardListSkeleton ({ count = 10 }: { count?: number }) {
  const total = Math.max(1, Math.trunc(count))
  return (
    <div>
      {Array.from({ length: total }, (_, index) => (
        <SalesOrderListRowSkeleton
          key={index}
          isLast={index === total - 1}
        />
      ))}
    </div>
  )
}

export function PedidosVendaTableRowSkeleton () {
  return (
    <TableRow aria-hidden='true'>
      <TableCell>
        <Skeleton className='h-4 w-14' />
      </TableCell>
      <TableCell>
        <Skeleton className='h-4 w-32' />
      </TableCell>
      <TableCell>
        <Skeleton className='h-4 w-40' />
      </TableCell>
      <TableCell>
        <Skeleton className='h-4 w-20' />
      </TableCell>
      <TableCell>
        <Skeleton className='h-5 w-16 rounded-full' />
      </TableCell>
      <TableCell className='text-right'>
        <Skeleton className='ml-auto h-8 w-8' />
      </TableCell>
    </TableRow>
  )
}

export function PedidosVendaTableBodySkeleton ({ count = 10 }: { count?: number }) {
  const total = Math.max(1, Math.trunc(count))
  return (
    <>
      {Array.from({ length: total }, (_, index) => (
        <PedidosVendaTableRowSkeleton key={index} />
      ))}
    </>
  )
}
