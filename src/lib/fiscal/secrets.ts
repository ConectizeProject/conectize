import 'server-only'
import crypto from 'crypto'

const SECRET_PREFIX = 'v1'

function getFiscalSecretsKey () {
  const raw = process.env.FISCAL_SECRETS_KEY || ''
  if (!raw.trim()) {
    throw new Error('missing_fiscal_secrets_key')
  }

  const trimmed = raw.trim()
  const base64 = Buffer.from(trimmed, 'base64')
  if (base64.length === 32) return base64

  const hex = Buffer.from(trimmed, 'hex')
  if (hex.length === 32) return hex

  const utf8 = Buffer.from(trimmed, 'utf8')
  if (utf8.length === 32) return utf8

  throw new Error('invalid_fiscal_secrets_key')
}

export function encryptFiscalSecret (plain: string | Buffer): string {
  const iv = crypto.randomBytes(12)
  const key = getFiscalSecretsKey()
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([
    cipher.update(typeof plain === 'string' ? Buffer.from(plain, 'utf8') : plain),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return [
    SECRET_PREFIX,
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':')
}

export function decryptFiscalSecretToBuffer (ciphertext: string): Buffer {
  const [version, ivRaw, tagRaw, dataRaw] = String(ciphertext || '').split(':')
  if (version !== SECRET_PREFIX || !ivRaw || !tagRaw || !dataRaw) {
    throw new Error('invalid_fiscal_ciphertext')
  }

  const key = getFiscalSecretsKey()
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivRaw, 'base64'))
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64'))

  return Buffer.concat([
    decipher.update(Buffer.from(dataRaw, 'base64')),
    decipher.final(),
  ])
}

export function decryptFiscalSecretToString (ciphertext: string): string {
  return decryptFiscalSecretToBuffer(ciphertext).toString('utf8')
}
