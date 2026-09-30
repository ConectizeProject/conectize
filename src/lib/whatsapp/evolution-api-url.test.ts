import { afterEach, describe, expect, it } from 'vitest'
import {
  isTrustedEvolutionEnvBaseUrl,
  sanitizeEvolutionApiBaseUrl,
} from '@/lib/whatsapp/evolution-api-url'

const originalEnv = {
  url: process.env.WHATSAPP_EVOLUTION_API_URL,
  nodeEnv: process.env.NODE_ENV,
}

afterEach(() => {
  if (originalEnv.url == null) delete process.env.WHATSAPP_EVOLUTION_API_URL
  else process.env.WHATSAPP_EVOLUTION_API_URL = originalEnv.url
  process.env.NODE_ENV = originalEnv.nodeEnv
})

describe('sanitizeEvolutionApiBaseUrl', () => {
  it('aceita a URL configurada no env mesmo se for localhost', () => {
    process.env.NODE_ENV = 'production'
    process.env.WHATSAPP_EVOLUTION_API_URL = 'http://localhost:8080'
    expect(sanitizeEvolutionApiBaseUrl('http://localhost:8080/')).toBe(
      'http://localhost:8080',
    )
  })

  it('bloqueia metadata e IPs privados em produção', () => {
    process.env.NODE_ENV = 'production'
    process.env.WHATSAPP_EVOLUTION_API_URL = 'https://evolution.conectize.com.br'
    expect(sanitizeEvolutionApiBaseUrl('http://169.254.169.254/latest/meta-data')).toBeNull()
    expect(sanitizeEvolutionApiBaseUrl('https://169.254.169.254')).toBeNull()
    expect(sanitizeEvolutionApiBaseUrl('https://10.0.0.8')).toBeNull()
    expect(sanitizeEvolutionApiBaseUrl('http://evil.example')).toBeNull()
    expect(sanitizeEvolutionApiBaseUrl('https://metadata.google.internal')).toBeNull()
  })

  it('aceita https público em produção', () => {
    process.env.NODE_ENV = 'production'
    process.env.WHATSAPP_EVOLUTION_API_URL = 'https://evolution.conectize.com.br'
    expect(sanitizeEvolutionApiBaseUrl('https://evo.cliente.example')).toBe(
      'https://evo.cliente.example',
    )
  })

  it('em desenvolvimento permite localhost', () => {
    process.env.NODE_ENV = 'development'
    process.env.WHATSAPP_EVOLUTION_API_URL = 'https://evolution.conectize.com.br'
    expect(sanitizeEvolutionApiBaseUrl('http://localhost:8080')).toBe(
      'http://localhost:8080',
    )
  })

  it('rejeita credenciais na URL', () => {
    process.env.NODE_ENV = 'production'
    expect(sanitizeEvolutionApiBaseUrl('https://user:pass@evo.example')).toBeNull()
  })
})

describe('isTrustedEvolutionEnvBaseUrl', () => {
  it('compara origem da URL de env', () => {
    process.env.WHATSAPP_EVOLUTION_API_URL = 'https://evolution.conectize.com.br/'
    expect(isTrustedEvolutionEnvBaseUrl('https://evolution.conectize.com.br')).toBe(true)
    expect(isTrustedEvolutionEnvBaseUrl('https://evo.cliente.example')).toBe(false)
  })
})
