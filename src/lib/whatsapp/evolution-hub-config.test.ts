import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isAllowedEvolutionApiBaseUrl,
  resolveEvolutionApiBaseUrl,
  resolveEvolutionApiKey,
} from '@/lib/whatsapp/evolution-hub-config'

describe('isAllowedEvolutionApiBaseUrl', () => {
  it('aceita https com host público', () => {
    expect(isAllowedEvolutionApiBaseUrl('https://evo.example.com')).toBe(true)
    expect(isAllowedEvolutionApiBaseUrl('https://evo.example.com/')).toBe(true)
  })

  it('rejeita http, localhost, IP privado e credencial na URL', () => {
    expect(isAllowedEvolutionApiBaseUrl('http://evo.example.com')).toBe(false)
    expect(isAllowedEvolutionApiBaseUrl('https://localhost/v2')).toBe(false)
    expect(isAllowedEvolutionApiBaseUrl('https://127.0.0.1/v2')).toBe(false)
    expect(isAllowedEvolutionApiBaseUrl('https://10.0.0.8/v2')).toBe(false)
    expect(isAllowedEvolutionApiBaseUrl('https://192.168.1.10/v2')).toBe(false)
    expect(isAllowedEvolutionApiBaseUrl('https://169.254.169.254/latest')).toBe(false)
    expect(isAllowedEvolutionApiBaseUrl('https://user:key@evo.example.com')).toBe(false)
    expect(isAllowedEvolutionApiBaseUrl('not-a-url')).toBe(false)
  })
})

describe('resolveEvolutionApiBaseUrl / resolveEvolutionApiKey', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('ignora override inválido e não envia a chave de ambiente para override', () => {
    vi.stubEnv('WHATSAPP_EVOLUTION_API_URL', 'https://platform.evolution.example')
    vi.stubEnv('WHATSAPP_EVOLUTION_API_KEY', 'platform-env-key-12345678')

    expect(
      resolveEvolutionApiBaseUrl({
        api_base_url_override: 'http://127.0.0.1:8080',
      }),
    ).toBe('')
    expect(
      resolveEvolutionApiBaseUrl({
        api_base_url_override: 'https://tenant.evolution.example',
      }),
    ).toBe('https://tenant.evolution.example')

    expect(
      resolveEvolutionApiKey(null, {
        api_base_url_override: 'https://tenant.evolution.example',
      }),
    ).toBe(null)
    expect(
      resolveEvolutionApiKey('tenant-key-abcdefgh', {
        api_base_url_override: 'https://tenant.evolution.example',
      }),
    ).toBe('tenant-key-abcdefgh')
    expect(resolveEvolutionApiKey(null, {})).toBe('platform-env-key-12345678')
  })
})
