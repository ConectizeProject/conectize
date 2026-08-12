import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Outfit } from 'next/font/google'
import { GoogleAnalyticsSafe } from '@/components/GoogleAnalyticsSafe'
import { business, getLocalBusinessJsonLd } from '@/lib/data/business'
import { THEME_BOOT_SCRIPT } from '@/lib/theme-boot-script'
import './globals.css'

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-outfit'
})

export const metadata: Metadata = {
  metadataBase: new URL(business.siteUrl),
  title: 'Assistência Técnica de Celular e Apple em Belo Horizonte | Conectize',
  description: 'Conserto de celulares e produtos Apple (iPhone, iPad, MacBook) em Belo Horizonte com coleta em domicílio. Especialistas Apple. Troca de tela, bateria, reparo de placa. Atendimento rápido e garantia!',
  keywords: 'assistência técnica de celular em belo horizonte, conserto de celulares belo horizonte, conserto de celular bh, assistência técnica iPhone bh, conserto iPhone belo horizonte, assistência apple bh, conserto macbook bh, troca de tela celular bh, troca de bateria bh, coleta em domicilio celular',
  authors: [{ name: 'Conectize' }],
  robots: 'index, follow',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      {
        rel: 'android-chrome',
        url: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        rel: 'android-chrome',
        url: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  },
  openGraph: {
    type: 'website',
    title: 'Assistência Técnica de Celular e Apple em Belo Horizonte | Conectize',
    description: 'Conserto de celulares e produtos Apple em Belo Horizonte com coleta em domicílio. Especialistas Apple. Atendimento rápido e garantia!',
    url: business.siteUrl,
    siteName: 'Conectize',
    locale: 'pt_BR',
  },
  alternates: {
    canonical: business.siteUrl,
  },
  other: {
    'geo.region': 'BR-MG',
    'geo.placename': 'Belo Horizonte, Santa Efigênia',
    'geo.position': '-19.9297;-43.9325',
    ICBM: '-19.9297, -43.9325',
  },
}

/** Sem isso, muitos mobile browsers usam viewport lógico ~980px e breakpoints (md/lg) tratam como desktop. */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Permite UA escuro no portal; o boot script + CSS evitam o flash preto
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#10151c' },
  ],
}

export default function RootLayout ({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={outfit.variable} suppressHydrationWarning>
      <head>
        {/* CSS mínimo no head: cobre o gap antes do globals.css / boot script */}
        <style
          dangerouslySetInnerHTML={{
            __html:
              'html{background-color:hsl(210 20% 98%);color-scheme:light}html.dark{background-color:hsl(215 25% 8%);color-scheme:dark}',
          }}
        />
      </head>
      <body>
        <Script
          id="theme-boot"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }}
        />
        <GoogleAnalyticsSafe />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(getLocalBusinessJsonLd()) }}
        />
        {children}
      </body>
    </html>
  )
}



