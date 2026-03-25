/** Comprimento mínimo alinhado às mensagens dos formulários do portal e ao Supabase. */
export const AUTH_PASSWORD_MIN_LENGTH = 8

export function isValidPassword (value: string): boolean {
  return value.length >= AUTH_PASSWORD_MIN_LENGTH
}
