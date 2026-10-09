export async function reserveSignupIp () {
	try {
		const response = await fetch('/api/auth/signup-ip', { method: 'POST' })
		return response.status !== 429
	} catch {
		return true
	}
}
