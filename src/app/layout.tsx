import type { Metadata } from 'next'
import { Outfit } from 'next/font/google'
import { Providers } from '@/providers/providers'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import { GoogleAnalytics } from '@/components/GoogleAnalytics'
import './globals.css'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://conectize.com.br'

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-outfit'
})

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Assistência Técnica de Celular e Apple em Belo Horizonte | Conectize',
  description: 'Conserto de celulares e produtos Apple (iPhone, iPad, MacBook) em Belo Horizonte com coleta em domicílio. Especialistas Apple. Troca de tela, bateria, reparo de placa. Atendimento rápido e garantia!',
  keywords: 'assistencia tecnica de celular em belo horizonte, concerto de celulares belo horizonte, conserto de celular bh, assistencia tecnica iPhone bh, conserto iPhone belo horizonte, assistencia apple bh, conserto macbook bh, troca de tela celular bh, coleta em domicilio celular',
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
    url: siteUrl,
    siteName: 'Conectize',
    locale: 'pt_BR',
  },
  other: {
    'geo.region': 'BR-MG',
    'geo.placename': 'Belo Horizonte, Santa Efigênia',
    'geo.position': '-19.9297;-43.9325',
    ICBM: '-19.9297, -43.9325',
  },
}

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': siteUrl,
  name: 'Conectize - Assistência Técnica de Celular e Apple',
  image: `${siteUrl}/logo_conectize.svg`,
  description: 'Assistência técnica especializada em conserto de celulares e produtos Apple (iPhone, iPad, MacBook) em Belo Horizonte. Troca de tela, bateria, reparo de placa e coleta em domicílio.',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'R. Padre Rolim, 620',
    addressLocality: 'Belo Horizonte',
    addressRegion: 'MG',
    postalCode: '30130-094',
    addressCountry: 'BR',
    neighborhood: 'Santa Efigênia',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: -19.9297,
    longitude: -43.9325,
  },
  url: siteUrl,
  telephone: '+5531986140889',
  priceRange: '$$',
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '08:00',
      closes: '18:00',
    },
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: 'Saturday',
      opens: '08:00',
      closes: '13:00',
    },
  ],
  sameAs: [],
  areaServed: {
    '@type': 'City',
    name: 'Belo Horizonte',
  },
  serviceType: [
    'Assistência técnica de celular',
    'Conserto de celulares',
    'Assistência técnica Apple',
    'Conserto de iPhone',
    'Conserto de iPad',
    'Conserto de MacBook',
    'Troca de tela de celular',
    'Troca de bateria de celular',
    'Coleta em domicílio',
  ],
}

export default function RootLayout ({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={outfit.variable} suppressHydrationWarning>
      <body>
        <GoogleAnalytics />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <NuqsAdapter>
          <Providers>
            {children}
          </Providers>
        </NuqsAdapter>
      </body>
    </html>
  )
}



