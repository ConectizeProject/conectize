'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { PedidosVendaList } from '@/app/(portal)/portal/vendas/PedidosVendaList'
import { FiscalDocumentsList } from '@/app/(portal)/portal/vendas/fiscal-documents/FiscalDocumentsList'

type ListTab = 'pedidos' | 'nfce' | 'nfe'

function listTabFromPath (pathname: string): ListTab | null {
  if (pathname === '/portal/vendas' || pathname === '/portal/vendas/') return 'pedidos'
  if (pathname === '/portal/vendas/nfce' || pathname === '/portal/vendas/nfce/') return 'nfce'
  if (pathname === '/portal/vendas/nfe' || pathname === '/portal/vendas/nfe/') return 'nfe'
  return null
}

function KeepAlivePane ({
  active,
  children,
}: {
  active: boolean
  children: React.ReactNode
}) {
  return (
    <div
      hidden={!active}
      {...(active ? {} : { inert: true })}
      className={active ? undefined : 'hidden'}
      aria-hidden={!active}
    >
      {children}
    </div>
  )
}

export function VendasListKeepAlive () {
  const pathname = usePathname() || '/portal/vendas'
  const listTab = listTabFromPath(pathname)
  const [visited, setVisited] = useState(() => ({
    pedidos: listTab === 'pedidos',
    nfce: listTab === 'nfce',
    nfe: listTab === 'nfe',
  }))

  useEffect(() => {
    if (!listTab) return
    setVisited((prev) => (prev[listTab] ? prev : { ...prev, [listTab]: true }))
  }, [listTab])

  return (
    <>
      {visited.pedidos ? (
        <KeepAlivePane active={listTab === 'pedidos'}>
          <PedidosVendaList />
        </KeepAlivePane>
      ) : null}
      {visited.nfce ? (
        <KeepAlivePane active={listTab === 'nfce'}>
          <FiscalDocumentsList model='65' />
        </KeepAlivePane>
      ) : null}
      {visited.nfe ? (
        <KeepAlivePane active={listTab === 'nfe'}>
          <FiscalDocumentsList model='55' />
        </KeepAlivePane>
      ) : null}
    </>
  )
}
