import { normalizeBlingProductId } from '@/lib/integrations/bling/api'

type BlingHttpClient = {
  request: <T = unknown>(options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
    path: string
    query?: Record<string, string | number | boolean | undefined | null>
    body?: unknown
  }) => Promise<T>
}

export type FetchBlingEstoquesMovimentacoesResult = {
  /** Resposta bruta do Bling (GET /estoques). */
  data: unknown
  /** Query que funcionou (idProduto numérico ou string). */
  queryUsed: Record<string, string | number>
}

/**
 * Lista lançamentos de estoque no Bling (GET /estoques) para o produto informado.
 * Tenta `idProduto` numérico e, se falhar, string — compatível com variações da API.
 */
export async function fetchBlingEstoquesMovimentacoes (
  client: BlingHttpClient,
  blingProductId: string,
  options?: { pagina?: number; limite?: number },
): Promise<FetchBlingEstoquesMovimentacoesResult> {
  const idStr = normalizeBlingProductId(blingProductId)
  if (!idStr) {
    throw new Error('bling_id_invalid')
  }

  const idNum = Number(idStr)
  const pagina = Math.max(1, Math.floor(Number(options?.pagina ?? 1)) || 1)
  const limite = Math.min(100, Math.max(1, Math.floor(Number(options?.limite ?? 50)) || 50))

  const queries: Record<string, string | number>[] = []
  if (Number.isFinite(idNum) && idNum > 0) {
    queries.push({ pagina, limite, idProduto: idNum })
  }
  queries.push({ pagina, limite, idProduto: idStr })

  let lastErr: unknown
  for (const query of queries) {
    try {
      const data = await client.request<unknown>({
        method: 'GET',
        path: '/estoques',
        query,
      })
      return { data, queryUsed: query }
    } catch (err) {
      lastErr = err
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error('bling_estoques_fetch_failed')
}

/** Extrai o array de lançamentos do envelope típico do Bling (`data`). */
export function unwrapEstoquesMovimentacoesItems (raw: unknown): unknown[] {
  const root =
    raw !== null && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}
  const d = root.data
  if (Array.isArray(d)) return d
  return []
}
