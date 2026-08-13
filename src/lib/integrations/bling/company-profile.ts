import { BLING_API_V3_BASE_URL } from '@/lib/integrations/bling/constants'

export type BlingCompanyProfile = {
  empresaId: string | null
  nome: string | null
  email: string | null
  cnpj: string | null
  logoUrl: string | null
}

function asRecord (value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function cleanText (value: unknown): string | null {
  const text = String(value ?? '').trim()
  return text || null
}

function cleanUrl (value: unknown): string | null {
  const text = cleanText(value)
  if (!text) return null
  if (!/^https?:\/\//i.test(text)) return null
  return text.slice(0, 2048)
}

function decodeJwtPayload (accessToken: string): Record<string, unknown> | null {
  const parts = String(accessToken || '').split('.')
  if (parts.length !== 3) return null
  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
    const json = Buffer.from(padded, 'base64').toString('utf8')
    return asRecord(JSON.parse(json))
  } catch {
    return null
  }
}

/**
 * Extrai perfil da empresa a partir da resposta de GET /empresas/me (e campos extras se existirem).
 */
export function parseBlingCompanyProfile (payload: unknown): BlingCompanyProfile {
  const root = asRecord(payload)
  const data = asRecord(root?.data) ?? root ?? {}

  const logoUrl =
    cleanUrl(data.logo)
    || cleanUrl(data.logoUrl)
    || cleanUrl(data.urlLogo)
    || cleanUrl(data.imagem)
    || cleanUrl(data.imagemURL)
    || cleanUrl(data.foto)
    || cleanUrl(asRecord(data.logo)?.url)
    || cleanUrl(asRecord(data.imagem)?.url)

  return {
    empresaId: cleanText(data.id),
    nome: cleanText(data.nome) || cleanText(data.razaoSocial) || cleanText(data.nomeFantasia),
    email: cleanText(data.email),
    cnpj: cleanText(data.cnpj),
    logoUrl,
  }
}

/** Fallback quando /empresas/me não está no escopo: tenta claims do JWT. */
export function parseBlingCompanyProfileFromAccessToken (
  accessToken: string,
): BlingCompanyProfile | null {
  const payload = decodeJwtPayload(accessToken)
  if (!payload) return null

  const empresa = asRecord(payload.empresa) ?? asRecord(payload.company) ?? asRecord(payload.organization)
  const usuario = asRecord(payload.usuario) ?? asRecord(payload.user)

  const profile: BlingCompanyProfile = {
    empresaId:
      cleanText(empresa?.id)
      || cleanText(payload.empresaId)
      || cleanText(payload.company_id)
      || cleanText(payload.idEmpresa),
    nome:
      cleanText(empresa?.nome)
      || cleanText(empresa?.razaoSocial)
      || cleanText(empresa?.nomeFantasia)
      || cleanText(payload.empresaNome)
      || cleanText(payload.company_name)
      || cleanText(payload.nomeEmpresa),
    email:
      cleanText(empresa?.email)
      || cleanText(usuario?.email)
      || cleanText(payload.email)
      || cleanText(payload.user_email),
    cnpj: cleanText(empresa?.cnpj) || cleanText(payload.cnpj),
    logoUrl:
      cleanUrl(empresa?.logo)
      || cleanUrl(empresa?.logoUrl)
      || cleanUrl(empresa?.imagemURL)
      || cleanUrl(payload.logoUrl),
  }

  if (!profile.nome && !profile.email && !profile.empresaId) return null
  return profile
}

export function hasUsefulBlingCompanyProfile (
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  if (!metadata || typeof metadata !== 'object') return false
  return Boolean(cleanText(metadata.nome) || cleanText(metadata.email))
}

/**
 * Busca perfil uma vez no momento da conexão (OAuth).
 * Não deve ser chamado em toda abertura do HUB.
 */
export async function fetchBlingCompanyProfile (
  accessToken: string,
): Promise<BlingCompanyProfile | null> {
  const token = String(accessToken || '').trim()
  if (!token) return null

  const fromJwt = parseBlingCompanyProfileFromAccessToken(token)

  try {
    const res = await fetch(`${BLING_API_V3_BASE_URL}/empresas/me`, {
      method: 'GET',
      headers: {
        Accept: '1.0',
        Authorization: `Bearer ${token}`,
        'enable-jwt': '1',
      },
      cache: 'no-store',
    })
    const data = await res.json().catch(() => null)
    if (res.ok) {
      const profile = parseBlingCompanyProfile(data)
      if (profile.nome || profile.email || profile.empresaId || profile.logoUrl) {
        return {
          empresaId: profile.empresaId ?? fromJwt?.empresaId ?? null,
          nome: profile.nome ?? fromJwt?.nome ?? null,
          email: profile.email ?? fromJwt?.email ?? null,
          cnpj: profile.cnpj ?? fromJwt?.cnpj ?? null,
          logoUrl: profile.logoUrl ?? fromJwt?.logoUrl ?? null,
        }
      }
    } else {
      const msg = String(
        (data as { error?: { message?: string; type?: string } } | null)?.error?.message
        || (data as { error?: string } | null)?.error
        || '',
      ).toLowerCase()
      if (!msg.includes('insufficient_scope') && !msg.includes('escopo')) {
        console.warn('[bling-company-profile]', res.status)
      }
    }
  } catch {
    // fallback JWT abaixo
  }

  return fromJwt
}

export function mergeBlingCompanyProfileMetadata (
  previous: Record<string, unknown> | null | undefined,
  profile: BlingCompanyProfile,
): Record<string, unknown> {
  const base = previous && typeof previous === 'object' ? { ...previous } : {}
  const next: Record<string, unknown> = {
    ...base,
    empresaId: profile.empresaId ?? base.empresaId ?? null,
    nome: profile.nome ?? base.nome ?? null,
    email: profile.email ?? base.email ?? null,
    cnpj: profile.cnpj ?? base.cnpj ?? null,
    logoUrl: profile.logoUrl ?? base.logoUrl ?? null,
  }
  if (profile.nome || profile.email || profile.empresaId || profile.logoUrl) {
    next.profileFetchedAt = new Date().toISOString()
  }
  return next
}
