/**
 * Header opcional no middleware (pathname + search) — pode não aparecer em `headers()` no RSC.
 * O fluxo principal de “voltar após login” usa redirect HTTP no middleware com `?redirectTo=`.
 */
export const PORTAL_INTENDED_PATH_HEADER = 'x-conectize-intended-path' as const
