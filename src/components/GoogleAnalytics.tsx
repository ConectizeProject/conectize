'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'

const GA_ID = 'G-1E45FFLYQY'
/** Opcional: ID da tag Google Ads (ex.: AW-123456789). */
const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim() || ''
/** Opcional: send_to da conversão clássica Ads (ex.: AW-123/AbCdEf). */
const ADS_WHATSAPP_SEND_TO =
	process.env.NEXT_PUBLIC_GOOGLE_ADS_WHATSAPP_SEND_TO?.trim() || ''

export function GoogleAnalytics() {
  const pathname = usePathname() || ''

  if (pathname.startsWith('/portal')) return null

  const primaryId = ADS_ID || GA_ID

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${primaryId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
          ${ADS_ID ? `gtag('config', '${ADS_ID}');` : ''}
          window.__conectizeAdsWhatsappSendTo = ${JSON.stringify(ADS_WHATSAPP_SEND_TO)};
        `}
      </Script>
    </>
  )
}
