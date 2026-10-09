import { describe, expect, it } from 'vitest'
import { resolveLegacyServiceDestination } from '@/lib/utils/legacy-service-redirect'
import { resolvePublicCrawlRedirect } from '@/lib/utils/public-crawl-redirect'

describe('resolvePublicCrawlRedirect', () => {
  it('sends the galaxy-a54 legacy path, with or without slash, to the final model url', () => {
    const expected = {
      pathname: '/servicos/troca-de-bateria-samsung-galaxy-a54',
      search: '',
    }
    expect(resolvePublicCrawlRedirect({
      pathname: '/servicos/samsung/troca-de-bateria/galaxy-a54',
      searchParams: new URLSearchParams(),
      host: 'www.conectize.com.br',
    })).toEqual(expected)
    expect(resolvePublicCrawlRedirect({
      pathname: '/servicos/samsung/troca-de-bateria/galaxy-a54/',
      searchParams: new URLSearchParams('attributes=COLOR'),
      host: 'conectize.com.br',
    })).toEqual(expected)
    expect(resolvePublicCrawlRedirect({
      pathname: '/servicos/troca-de-bateria-samsung-galaxy-a54',
      searchParams: new URLSearchParams(),
      host: 'www.conectize.com.br',
    })).toBeNull()
  })

  it('collapses duplicated smartphone labels onto the hub', () => {
    expect(resolvePublicCrawlRedirect({
      pathname: '/servicos/reparo-de-agua-motorola-smartphone-Smartphone',
      searchParams: new URLSearchParams(),
      host: 'www.conectize.com.br',
    })).toEqual({
      pathname: '/servicos/reparo-de-agua-motorola-smartphone',
      search: '',
    })
    expect(resolvePublicCrawlRedirect({
      pathname: '/servicos/troca-de-camera-xiaomi-smartphone-Smartphone/',
      searchParams: new URLSearchParams(),
      host: 'www.conectize.com.br',
    })).toEqual({
      pathname: '/servicos/troca-de-camera-xiaomi-smartphone',
      search: '',
    })
  })

  it('sends brand/service indexes to a final url without filter params', () => {
    expect(resolvePublicCrawlRedirect({
      pathname: '/servicos/apple/reparo-de-placa',
      searchParams: new URLSearchParams(),
      host: 'www.conectize.com.br',
    })).toEqual({
      pathname: '/conserto-de-celular-belo-horizonte',
      search: '',
    })
    expect(resolvePublicCrawlRedirect({
      pathname: '/servicos/reparo-de-placa/apple',
      searchParams: new URLSearchParams(),
      host: 'www.conectize.com.br',
    })?.search).toBe('')
  })

  it('drops Mercado Livre paths and attributes in one hop', () => {
    expect(resolvePublicCrawlRedirect({
      pathname: '/MLB-1234567890',
      searchParams: new URLSearchParams('attributes=COLOR'),
      host: 'www.conectize.com.br',
    })).toEqual({ pathname: '/acessorios', search: '' })
    expect(resolvePublicCrawlRedirect({
      pathname: '/iphone-11/p/MLB123456',
      searchParams: new URLSearchParams('attributes=1'),
      host: 'www.conectize.com.br',
    })).toEqual({ pathname: '/acessorios', search: '' })
    expect(resolvePublicCrawlRedirect({
      pathname: '/MLB998877',
      searchParams: new URLSearchParams(),
      host: 'www.conectize.com.br',
    })).toEqual({ pathname: '/acessorios', search: '' })
    expect(resolvePublicCrawlRedirect({
      pathname: '/acessorios',
      searchParams: new URLSearchParams('attributes=BRAND'),
      host: 'www.conectize.com.br',
    })).toEqual({ pathname: '/acessorios', search: '' })
  })

  it('strips junk query without removing catalog filters', () => {
    expect(resolvePublicCrawlRedirect({
      pathname: '/conserto-de-celular-belo-horizonte',
      searchParams: new URLSearchParams('servico=troca-de-bateria&attributes=1'),
      host: 'www.conectize.com.br',
    })).toEqual({
      pathname: '/conserto-de-celular-belo-horizonte',
      search: '?servico=troca-de-bateria',
    })
  })

  it('does not chain: the destination is not another legacy service path', () => {
    const samples = [
      '/servicos/samsung/troca-de-bateria/galaxy-a54/',
      '/servicos/reparo-de-agua-motorola-smartphone-Smartphone',
      '/servicos/apple/reparo-de-placa',
      '/servicos/troca-de-bateria/samsung/galaxy-a54',
    ]
    for (const pathname of samples) {
      const target = resolvePublicCrawlRedirect({
        pathname,
        searchParams: new URLSearchParams(),
        host: 'www.conectize.com.br',
      })
      expect(target).toBeTruthy()
      const again = resolvePublicCrawlRedirect({
        pathname: target?.pathname ?? '/',
        searchParams: new URLSearchParams(target?.search.replace(/^\?/, '') ?? ''),
        host: 'www.conectize.com.br',
      })
      expect(again).toBeNull()
      if (target?.pathname.startsWith('/servicos/')) {
        const slug = target.pathname.slice('/servicos/'.length)
        expect(resolveLegacyServiceDestination([slug])).toBeNull()
      }
    }
  })

  it('leaves a normal page alone', () => {
    expect(resolvePublicCrawlRedirect({
      pathname: '/contato',
      searchParams: new URLSearchParams(),
      host: 'www.conectize.com.br',
    })).toBeNull()
  })

  it('still flags the apex host when the path is already canonical', () => {
    expect(resolvePublicCrawlRedirect({
      pathname: '/contato',
      searchParams: new URLSearchParams(),
      host: 'conectize.com.br',
    })).toEqual({ pathname: '/contato', search: '' })
    expect(resolvePublicCrawlRedirect({
      pathname: '/servicos/troca-de-bateria-samsung-galaxy-a54',
      searchParams: new URLSearchParams(),
      host: 'conectize.com.br:443',
    })).toEqual({
      pathname: '/servicos/troca-de-bateria-samsung-galaxy-a54',
      search: '',
    })
  })
})
