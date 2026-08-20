import { onlyDigits } from '@/lib/utils/strings'

export async function lookupIbgeCityCodeFromCep (cep: string): Promise<string | null> {
  const zip = onlyDigits(cep)
  if (zip.length !== 8) return null

  try {
    const res = await fetch(`https://viacep.com.br/ws/${zip}/json/`, {
      signal: AbortSignal.timeout(8000),
    })
    const data = await res.json().catch(() => null) as { erro?: boolean, ibge?: string } | null
    if (!res.ok || !data || data.erro) return null
    const ibge = onlyDigits(String(data.ibge || '')).slice(0, 7)
    return ibge.length === 7 ? ibge : null
  } catch {
    return null
  }
}
