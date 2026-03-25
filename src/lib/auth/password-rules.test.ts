import { describe, expect, it } from 'vitest'
import { AUTH_PASSWORD_MIN_LENGTH, isValidPassword } from '@/lib/auth/password-rules'

describe('isValidPassword', () => {
  it('rejeita senha mais curta que o mínimo', () => {
    expect(isValidPassword('a'.repeat(AUTH_PASSWORD_MIN_LENGTH - 1))).toBe(false)
  })

  it('aceita senha com comprimento mínimo', () => {
    expect(isValidPassword('a'.repeat(AUTH_PASSWORD_MIN_LENGTH))).toBe(true)
  })

  it('aceita senha mais longa que o mínimo', () => {
    expect(isValidPassword('a'.repeat(AUTH_PASSWORD_MIN_LENGTH + 4))).toBe(true)
  })
})
