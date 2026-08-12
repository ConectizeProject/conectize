import { describe, expect, it } from 'vitest'
import { getBreadcrumbJsonLd } from '@/components/seo/Breadcrumbs'
import { getSiteUrl } from '@/lib/utils/site-url'

describe('getBreadcrumbJsonLd', () => {
  it('emits absolute www URLs and 1-based positions', () => {
    const jsonLd = getBreadcrumbJsonLd([
      { label: 'Home', href: '/' },
      { label: 'Serviços', href: '/servicos' },
      { label: 'Troca de Tela', href: '/servicos/troca-de-tela-apple-iphone' },
    ])

    expect(jsonLd['@type']).toBe('BreadcrumbList')
    expect(jsonLd.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: `${getSiteUrl()}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Serviços',
        item: `${getSiteUrl()}/servicos`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Troca de Tela',
        item: `${getSiteUrl()}/servicos/troca-de-tela-apple-iphone`,
      },
    ])
  })
})
