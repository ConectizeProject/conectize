'use client'

import { useEffect, useState, Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { PedidosVendaList } from '@/app/(portal)/portal/vendas/PedidosVendaList'
import { SoldProductsList } from '@/app/(portal)/portal/vendas/SoldProductsList'
import { FiscalDocumentsList } from '@/app/(portal)/portal/vendas/fiscal-documents/FiscalDocumentsList'
import { parseSalesLane } from '@/lib/vendas/sales-lane'
import {
  salesListSectionFromPath,
  salesListSessionRedirectTarget,
  writeSalesListSession,
} from '@/lib/vendas/sales-list-session'

type ListTab = 'pedidos' | 'produtos' | 'nfce' | 'nfe'

function listTabFromPath (pathname: string): ListTab | null {
  if (pathname === '/portal/vendas' || pathname === '/portal/vendas/') return 'pedidos'
  if (pathname === '/portal/vendas/produtos' || pathname === '/portal/vendas/produtos/') {
    return 'produtos'
  }
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
  const searchParams = useSearchParams()
  const router = useRouter()
  const listTab = listTabFromPath(pathname)
  const [sessionReady, setSessionReady] = useState(false)
  const [visited, setVisited] = useState({
    pedidos: false,
    produtos: false,
    nfce: false,
    nfe: false,
  })

  useEffect(() => {
    if (!listTab) return
    if (salesListSectionFromPath(pathname) && !sessionReady) return
    setVisited((prev) => (prev[listTab] ? prev : { ...prev, [listTab]: true }))
  }, [listTab, pathname, sessionReady])

  useEffect(() => {
    const section = salesListSectionFromPath(pathname)
    if (!section) return
    const query = searchParams.toString()
    const redirectTarget = salesListSessionRedirectTarget(pathname, query)
    if (redirectTarget) {
      router.replace(redirectTarget)
      return
    }
    const urlLane = parseSalesLane(searchParams.get('lane'))
    if (urlLane) writeSalesListSession({ section, lane: urlLane })
    setSessionReady(true)
  }, [pathname, router, searchParams])

  if (salesListSectionFromPath(pathname) && !sessionReady) {
    return <p className="p-4 text-sm text-muted-foreground">Carregando…</p>
  }

  return (
    <>
      {visited.pedidos ? (
        <KeepAlivePane active={listTab === 'pedidos'}>
          <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Carregando…</p>}>
            <PedidosVendaList />
          </Suspense>
        </KeepAlivePane>
      ) : null}
      {visited.produtos ? (
        <KeepAlivePane active={listTab === 'produtos'}>
          <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Carregando…</p>}>
            <SoldProductsList />
          </Suspense>
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
