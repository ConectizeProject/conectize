const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function parseCompatibleModelIdsFromForm (raw: FormDataEntryValue | null): string[] {
  try {
    const parsed = JSON.parse(String(raw || '[]')) as unknown
    if (!Array.isArray(parsed)) return []
    const out: string[] = []
    for (const e of parsed) {
      if (typeof e !== 'string') continue
      const s = e.trim().toLowerCase()
      if (UUID_RE.test(s)) out.push(s)
    }
    return [...new Set(out)]
  } catch {
    return []
  }
}
