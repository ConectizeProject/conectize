import { describe, expect, it } from 'vitest'
import {
  canonicalRedirectStatus,
  resolveCanonicalRedirect,
} from '@/lib/utils/canonical-host'
import { CANONICAL_SITE_ORIGIN } from '@/lib/utils/site-url'

describe('resolveCanonicalRedirect', () => {
  it('redirects apex to https www and keeps path and query', () => {
    expect(resolveCanonicalRedirect({
      hostname: 'conectize.com.br',
      protocol: 'https',
      pathname: '/contato',
      search: '?utm=1&ref=gsc',
    })).toBe(`${CANONICAL_SITE_ORIGIN}/contato?utm=1&ref=gsc`)
  })

  it('redirects http www to https www', () => {
    expect(resolveCanonicalRedirect({
      hostname: 'www.conectize.com.br',
      protocol: 'http:',
      pathname: '/loja',
      search: '',
    })).toBe(`${CANONICAL_SITE_ORIGIN}/loja`)
  })

  it('redirects http apex in one hop to https www', () => {
    expect(resolveCanonicalRedirect({
      hostname: 'CONECTIZE.COM.BR:80',
      protocol: 'http, https',
      pathname: '/',
      search: '?q=1',
    })).toBe(`${CANONICAL_SITE_ORIGIN}/?q=1`)
  })

  it('leaves the canonical https host alone', () => {
    expect(resolveCanonicalRedirect({
      hostname: 'www.conectize.com.br',
      protocol: 'https',
      pathname: '/',
      search: '',
    })).toBeNull()
  })

  it('does not redirect localhost or vercel previews', () => {
    expect(resolveCanonicalRedirect({
      hostname: 'localhost',
      protocol: 'http',
      pathname: '/',
      search: '',
    })).toBeNull()
    expect(resolveCanonicalRedirect({
      hostname: '127.0.0.1:3000',
      protocol: 'http',
      pathname: '/contato',
      search: '',
    })).toBeNull()
    expect(resolveCanonicalRedirect({
      hostname: 'conectize-git-abc123-team.vercel.app',
      protocol: 'https',
      pathname: '/',
      search: '',
    })).toBeNull()
  })

  it('does not redirect unrelated hosts', () => {
    expect(resolveCanonicalRedirect({
      hostname: 'evolution.conectize.com.br',
      protocol: 'https',
      pathname: '/',
      search: '',
    })).toBeNull()
    expect(resolveCanonicalRedirect({
      hostname: '',
      protocol: 'https',
      pathname: '/',
      search: '',
    })).toBeNull()
  })
})

describe('canonicalRedirectStatus', () => {
  it('uses 301 for crawler methods and 308 for the rest', () => {
    expect(canonicalRedirectStatus('GET')).toBe(301)
    expect(canonicalRedirectStatus('head')).toBe(301)
    expect(canonicalRedirectStatus('POST')).toBe(308)
    expect(canonicalRedirectStatus('PUT')).toBe(308)
  })
})
