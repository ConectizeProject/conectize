import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isAllowedOrganizationLogoUrl,
  resolveAllowedOrganizationLogoFetchUrl,
} from '@/lib/organizations/organization-logo-url'

const opts = {
  siteOrigin: 'https://www.conectize.com.br',
  supabaseUrl: 'https://abcd.supabase.co',
}

describe('isAllowedOrganizationLogoUrl', () => {
  it('aceita vazio, path relativo do site e storage de logos', () => {
    expect(isAllowedOrganizationLogoUrl('', opts)).toBe(true)
    expect(isAllowedOrganizationLogoUrl('/brand/logo.png', opts)).toBe(true)
    expect(
      isAllowedOrganizationLogoUrl(
        'https://www.conectize.com.br/brand/logo.png',
        opts,
      ),
    ).toBe(true)
    expect(
      isAllowedOrganizationLogoUrl(
        'https://abcd.supabase.co/storage/v1/object/public/organization-logos/org/a.png',
        opts,
      ),
    ).toBe(true)
  })

  it('rejeita URL externa, protocol-relative e bucket que não é de logo', () => {
    expect(isAllowedOrganizationLogoUrl('https://evil.example/x.png', opts)).toBe(false)
    expect(isAllowedOrganizationLogoUrl('http://169.254.169.254/latest', opts)).toBe(false)
    expect(isAllowedOrganizationLogoUrl('//evil.example/x.png', opts)).toBe(false)
    expect(
      isAllowedOrganizationLogoUrl(
        'https://abcd.supabase.co/storage/v1/object/public/whatsapp-media/a.png',
        opts,
      ),
    ).toBe(false)
    expect(
      isAllowedOrganizationLogoUrl(
        'https://user:pass@www.conectize.com.br/logo.png',
        opts,
      ),
    ).toBe(false)
  })
})

describe('resolveAllowedOrganizationLogoFetchUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('resolve path relativo no site e esvazia URL fora da allowlist', () => {
    expect(resolveAllowedOrganizationLogoFetchUrl('/logo.png', opts)).toBe(
      'https://www.conectize.com.br/logo.png',
    )
    expect(resolveAllowedOrganizationLogoFetchUrl('https://evil.example/x', opts)).toBe('')
    expect(resolveAllowedOrganizationLogoFetchUrl('//evil.example/x', opts)).toBe('')
  })

  it('normaliza o host apex do env para www ao resolver path relativo', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://conectize.com.br')
    expect(resolveAllowedOrganizationLogoFetchUrl('/logo.png')).toBe(
      'https://www.conectize.com.br/logo.png',
    )
  })
})
