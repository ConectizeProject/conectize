import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export const MCP_TOKEN_PREFIX = 'czmcp_'

export function hashMcpToken(token: string): string {
	return createHash('sha256').update(token).digest('hex')
}

export function generateMcpToken(): { token: string; tokenHash: string } {
	const token = `${MCP_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`
	return { token, tokenHash: hashMcpToken(token) }
}

export function tokenHashMatches(
	storedHash: string,
	presentedHash: string,
): boolean {
	const stored = Buffer.from(storedHash)
	const presented = Buffer.from(presentedHash)
	if (stored.length !== presented.length || stored.length === 0) return false
	return timingSafeEqual(stored, presented)
}

export function readBearerToken(authorization: string | null): string | null {
	if (!authorization) return null
	const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim())
	if (!match) return null
	const token = match[1]
	if (!token.startsWith(MCP_TOKEN_PREFIX)) return null
	if (token.length < MCP_TOKEN_PREFIX.length + 32) return null
	return token
}
