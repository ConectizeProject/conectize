'use client'

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

function sameDestinationAsWindow (nextPath: string, nextSearch: string) {
  const current = `${window.location.pathname}${window.location.search}`
  const target = `${nextPath}${nextSearch}`
  return current === target
}

export function NavigationProgress () {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [visible, setVisible] = useState(false)

  const routeKey = `${pathname}?${searchParams.toString()}`

  useEffect(() => {
    setVisible(false)
  }, [routeKey])

  useEffect(() => {
    function onClickCapture (e: MouseEvent) {
      if (e.button !== 0) return
      const raw = (e.target as HTMLElement | null)?.closest('a')
      if (!raw) return
      const a = raw as HTMLAnchorElement
      if (a.target === '_blank' || a.download) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const hrefAttr = a.getAttribute('href')
      if (!hrefAttr || hrefAttr.startsWith('#')) return
      if (hrefAttr.startsWith('mailto:') || hrefAttr.startsWith('tel:')) return

      let nextPath: string
      let nextSearch: string
      try {
        const url = new URL(hrefAttr, window.location.origin)
        if (url.origin !== window.location.origin) return
        nextPath = url.pathname
        nextSearch = url.search
      } catch {
        return
      }

      if (sameDestinationAsWindow(nextPath, nextSearch)) return

      setVisible(true)
    }

    function onPopState () {
      setVisible(true)
    }

    document.addEventListener('click', onClickCapture, true)
    function onProgrammaticStart () {
      setVisible(true)
    }

    window.addEventListener('popstate', onPopState)
    window.addEventListener('connectize:navigation-start', onProgrammaticStart)
    return () => {
      document.removeEventListener('click', onClickCapture, true)
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('connectize:navigation-start', onProgrammaticStart)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-primary/15"
      role="progressbar"
      aria-busy="true"
      aria-label="Carregando página"
    >
      <div className="h-full w-[35%] max-w-md animate-navigation-indeterminate bg-primary shadow-[0_0_12px_hsl(var(--primary))]" />
    </div>
  )
}
