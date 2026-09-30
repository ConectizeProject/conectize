import { afterEach, describe, expect, it } from 'vitest'
import {
  resolveEvolutionApiAccess,
  resolveEvolutionApiKey,
} from '@/lib/whatsapp/evolution-hub-config'

const original = {
  url: process.env.WHATSAPP_EVOLUTION_API_URL,
  key: process.env.WHATSAPP_EVOLUTION_API_KEY,
  nodeEnv: process.env.NODE_ENV,
}

afterEach(() => {
  if (original.url == null) delete process.env.WHATSAPP_EVOLUTION_API_URL
  else process.env.WHATSAPP_EVOLUTION_API_URL = original.url
  if (original.key == null) delete process.env.WHATSAPP_EVOLUTION_API_KEY
  else process.env.WHATSAPP_EVOLUTION_API_KEY = original.key
  process.env.NODE_ENV = original.nodeEnv
})

describe('resolveEvolutionApiKey', () => {
  it('não envia a key de ambiente para host do tenant', () => {
    process.env.NODE_ENV = 'production'
    process.env.WHATSAPP_EVOLUTION_API_URL = 'https://evolution.conectize.com.br'
    process.env.WHATSAPP_EVOLUTION_API_KEY = 'platform-env-key-32charsxxxx'
    expect(
      resolveEvolutionApiKey(null, 'https://evo.cliente.example'),
    ).toBeNull()
  })

  it('usa a key de ambiente só na URL confiável', () => {
    process.env.NODE_ENV = 'production'
    process.env.WHATSAPP_EVOLUTION_API_URL = 'https://evolution.conectize.com.br'
    process.env.WHATSAPP_EVOLUTION_API_KEY = 'platform-env-key-32charsxxxx'
    expect(
      resolveEvolutionApiKey(null, 'https://evolution.conectize.com.br'),
    ).toBe('platform-env-key-32charsxxxx')
  })

  it('não usa a key de ambiente sem URL', () => {
    process.env.WHATSAPP_EVOLUTION_API_KEY = 'platform-env-key-32charsxxxx'
    expect(resolveEvolutionApiKey(null)).toBeNull()
  })
})

describe('resolveEvolutionApiAccess', () => {
  it('aceita override https com api key do hub', () => {
    process.env.NODE_ENV = 'production'
    process.env.WHATSAPP_EVOLUTION_API_URL = 'https://evolution.conectize.com.br'
    process.env.WHATSAPP_EVOLUTION_API_KEY = 'platform-env-key-32charsxxxx'
    const access = resolveEvolutionApiAccess(
      { api_base_url_override: 'https://evo.cliente.example' },
      'hub-api-key-32charactersxxxx',
    )
    expect(access).toEqual({
      baseUrl: 'https://evo.cliente.example',
      apiKey: 'hub-api-key-32charactersxxxx',
    })
  })

  it('não vazia a key de ambiente quando o override é de outro host', () => {
    process.env.NODE_ENV = 'production'
    process.env.WHATSAPP_EVOLUTION_API_URL = 'https://evolution.conectize.com.br'
    process.env.WHATSAPP_EVOLUTION_API_KEY = 'platform-env-key-32charsxxxx'
    expect(
      resolveEvolutionApiAccess(
        { api_base_url_override: 'https://evo.cliente.example' },
        null,
      ),
    ).toBeNull()
  })
})
