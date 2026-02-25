'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'

const GA_ID = 'G-1E45FFLYQY'

const PORTAL_PUBLIC_PATHS = [
  '/portal/login',
  '/portal/auth/callback',
  '/portal/redefinir-senha',
  '/portal/cadastro',
]

function isPortalLoggedInPath(pathname: string): boolean {
  if (!pathname.startsWith('/portal')) return false
  if (pathname === '/portal') return true
  return !PORTAL_PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export function GoogleAnalytics() {
  const pathname = usePathname()
  const shouldLoad = pathname != null && !isPortalLoggedInPath(pathname)

  if (!shouldLoad) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  )
}
