/**
 * Busca de produtos no portal: várias palavras = todas devem aparecer (em qualquer ordem),
 * cada uma em nome, SKU ou código de barras (OR entre colunas).
 */

export function parseProductSearchTokens (raw: string): string[] {
  const s = raw.trim().replaceAll(',', ' ')
  return s.split(/\s+/).map((t) => t.trim()).filter((t) => t.length > 0)
}

/** Evita que % _ \\ quebrem o padrão ILIKE do PostgREST. */
export function sanitizeIlikeToken (token: string): string {
  return token.replace(/[%_\\]/g, '').trim()
}

export function effectiveSearchTokens (raw: string): string[] {
  const out: string[] = []
  for (const t of parseProductSearchTokens(raw)) {
    const s = sanitizeIlikeToken(t)
    if (s.length > 0) out.push(s)
  }
  return out
}
