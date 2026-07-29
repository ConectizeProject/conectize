import { services } from './services'
import { getSiteUrl } from '@/lib/utils/site-url'

export type FaqItem = {
  q: string
  a: string
}

export const business = {
  siteUrl: getSiteUrl(),
  name: 'Conectize',
  legalName: 'Conectize',
  label: 'Conectize - Assistência Técnica de Celular e Apple',
  description: 'Assistência técnica especializada em conserto de celulares e produtos Apple em Belo Horizonte, com coleta em domicílio, garantia e atendimento por WhatsApp.',
  phone: '+5531986140889',
  phoneDisplay: '(31) 9 8614-0889',
  whatsappUrl: 'https://wa.me/5531986140889',
  email: 'contato@conectize.com.br',
  cnpj: '44.957.050/0001-37',
  priceRange: '$$',
  logoPath: '/logo_conectize.svg',
  address: {
    streetAddress: 'R. Padre Rolim, 620',
    neighborhood: 'Santa Efigênia',
    addressLocality: 'Belo Horizonte',
    addressRegion: 'MG',
    postalCode: '30130-094',
    addressCountry: 'BR',
    full: 'R. Padre Rolim, 620 - Santa Efigênia, Belo Horizonte - MG, 30130-094'
  },
  geo: {
    latitude: -19.9297,
    longitude: -43.9325
  },
  openingHours: [
    {
      label: 'Segunda a Sexta',
      shortLabel: 'Seg-sex',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '08:30',
      closes: '18:30',
      display: '08:30h às 18:30h'
    },
    {
      label: 'Sábado',
      shortLabel: 'Sáb',
      dayOfWeek: 'Saturday',
      opens: '10:00',
      closes: '14:00',
      display: '10h às 14h'
    }
  ],
  sameAs: [
    'https://www.instagram.com/conectizeoficial/',
    'https://www.facebook.com/ConectizeStore/',
    'https://www.google.com/maps?cid=5763292227509758608'
  ],
  hasMap: 'https://www.google.com/maps?cid=5763292227509758608',
  mapsDirectionsUrl: 'https://www.google.com/maps/dir//R.+Padre+Rolim,+620+-+Santa+Efigênia,+Belo+Horizonte+-+MG,+30130-094',
  areaServedNeighborhoods: [
    'Santa Efigênia',
    'Centro',
    'Savassi',
    'Funcionários',
    'Lourdes',
    'Floresta',
    'Barro Preto',
    'Santo Antônio',
    'Carmo',
    'Serra'
  ],
  serviceTypes: [
    'Assistência técnica de celular',
    'Conserto de celulares',
    'Assistência técnica Apple',
    'Conserto de iPhone',
    'Conserto de iPad',
    'Conserto de MacBook',
    'Troca de tela de celular',
    'Troca de vidro da tela',
    'Troca de vidro/tampa traseira',
    'Troca de bateria de celular',
    'Reparo de placa',
    'Coleta em domicílio'
  ]
} as const

export function buildWhatsAppUrl(message: string) {
  return `${business.whatsappUrl}?text=${encodeURIComponent(message)}`
}

export function getFormattedOpeningHours() {
  return business.openingHours.map((item) => `${item.label}: ${item.display}`)
}

export function getLocalBusinessJsonLd() {
  const logoUrl = `${business.siteUrl}${business.logoPath}`

  return {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'ElectronicsStore'],
    '@id': `${business.siteUrl}/#localbusiness`,
    name: business.label,
    legalName: business.legalName,
    image: logoUrl,
    logo: logoUrl,
    description: business.description,
    url: business.siteUrl,
    telephone: business.phone,
    email: business.email,
    priceRange: business.priceRange,
    hasMap: business.hasMap,
    sameAs: business.sameAs,
    address: {
      '@type': 'PostalAddress',
      streetAddress: business.address.streetAddress,
      addressLocality: business.address.addressLocality,
      addressRegion: business.address.addressRegion,
      postalCode: business.address.postalCode,
      addressCountry: business.address.addressCountry,
      neighborhood: business.address.neighborhood
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: business.geo.latitude,
      longitude: business.geo.longitude
    },
    openingHoursSpecification: business.openingHours.map((item) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: item.dayOfWeek,
      opens: item.opens,
      closes: item.closes
    })),
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: business.phone,
      contactType: 'customer service',
      availableLanguage: 'Portuguese'
    },
    areaServed: [
      {
        '@type': 'City',
        name: 'Belo Horizonte',
        addressRegion: 'MG',
        addressCountry: 'BR'
      },
      ...business.areaServedNeighborhoods.map((name) => ({
        '@type': 'Place',
        name: `${name}, Belo Horizonte - MG`
      }))
    ],
    serviceType: business.serviceTypes,
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Serviços de assistência técnica Conectize',
      itemListElement: [
        ...services.map((service) => ({
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: service.name,
            description: service.shortDescription,
            areaServed: 'Belo Horizonte'
          }
        })),
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Coleta em domicílio',
            description: 'Coleta e entrega de aparelhos para manutenção em Belo Horizonte.',
            areaServed: 'Belo Horizonte'
          }
        }
      ]
    }
  }
}

export function getFaqPageJsonLd(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a
      }
    }))
  }
}

export function getServiceJsonLd(input: {
  name: string
  description: string
  url: string
  serviceType?: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: input.name,
    description: input.description,
    serviceType: input.serviceType || input.name,
    url: input.url,
    areaServed: {
      '@type': 'City',
      name: 'Belo Horizonte'
    },
    provider: {
      '@type': 'LocalBusiness',
      '@id': `${business.siteUrl}/#localbusiness`,
      name: business.name,
      telephone: business.phone,
      address: {
        '@type': 'PostalAddress',
        streetAddress: business.address.streetAddress,
        addressLocality: business.address.addressLocality,
        addressRegion: business.address.addressRegion,
        postalCode: business.address.postalCode,
        addressCountry: business.address.addressCountry
      }
    }
  }
}
