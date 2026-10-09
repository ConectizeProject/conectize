import { afterEach, describe, expect, it, vi } from 'vitest'
import {
	isAllowedEvolutionApiBaseUrl,
	pickEvolutionHubByInstanceName,
	resolveEvolutionApiBaseUrl,
	resolveEvolutionApiKey,
} from '@/lib/whatsapp/evolution-hub-config'

describe('isAllowedEvolutionApiBaseUrl', () => {
	it('aceita https com host público', () => {
		expect(isAllowedEvolutionApiBaseUrl('https://evo.example.com')).toBe(true)
		expect(isAllowedEvolutionApiBaseUrl('https://evo.example.com/')).toBe(true)
	})

	it('rejeita http, localhost, IP privado e credencial na URL', () => {
		expect(isAllowedEvolutionApiBaseUrl('http://evo.example.com')).toBe(false)
		expect(isAllowedEvolutionApiBaseUrl('https://localhost/v2')).toBe(false)
		expect(isAllowedEvolutionApiBaseUrl('https://127.0.0.1/v2')).toBe(false)
		expect(isAllowedEvolutionApiBaseUrl('https://10.0.0.8/v2')).toBe(false)
		expect(isAllowedEvolutionApiBaseUrl('https://192.168.1.10/v2')).toBe(false)
		expect(isAllowedEvolutionApiBaseUrl('https://169.254.169.254/latest')).toBe(
			false,
		)
		expect(
			isAllowedEvolutionApiBaseUrl('https://user:key@evo.example.com'),
		).toBe(false)
		expect(isAllowedEvolutionApiBaseUrl('not-a-url')).toBe(false)
	})
})

describe('resolveEvolutionApiBaseUrl / resolveEvolutionApiKey', () => {
	afterEach(() => {
		vi.unstubAllEnvs()
	})

	it('ignora override inválido e não envia a chave de ambiente para override', () => {
		vi.stubEnv(
			'WHATSAPP_EVOLUTION_API_URL',
			'https://platform.evolution.example',
		)
		vi.stubEnv('WHATSAPP_EVOLUTION_API_KEY', 'platform-env-key-12345678')

		expect(
			resolveEvolutionApiBaseUrl({
				api_base_url_override: 'http://127.0.0.1:8080',
			}),
		).toBe('')
		expect(
			resolveEvolutionApiBaseUrl({
				api_base_url_override: 'https://tenant.evolution.example',
			}),
		).toBe('https://tenant.evolution.example')

		expect(
			resolveEvolutionApiKey(null, {
				api_base_url_override: 'https://tenant.evolution.example',
			}),
		).toBe(null)
		expect(
			resolveEvolutionApiKey('tenant-key-abcdefgh', {
				api_base_url_override: 'https://tenant.evolution.example',
			}),
		).toBe('tenant-key-abcdefgh')
		expect(resolveEvolutionApiKey(null, {})).toBe('platform-env-key-12345678')
	})
})

describe('pickEvolutionHubByInstanceName', () => {
	const victim = {
		id: 'hub-victim',
		access_token: 'token-victim',
		metadata: { instance_name: 'conectize-prod' },
		organization_id: 'org-victim',
	}
	const squatter = {
		id: 'hub-squatter',
		access_token: 'token-squatter',
		metadata: { instance_name: 'Conectize-Prod' },
		organization_id: 'org-attacker',
	}

	it('retorna o único hub com o nome, ignorando caixa', () => {
		const picked = pickEvolutionHubByInstanceName([victim], ' CONECTIZE-PROD ')
		expect(picked.ok).toBe(true)
		if (picked.ok === true) {
			expect(picked.hub.organization_id).toBe('org-victim')
			expect(picked.hub.id).toBe('hub-victim')
		}
	})

	it('falha fechado quando dois tenants reclamam o mesmo instance_name', () => {
		const picked = pickEvolutionHubByInstanceName(
			[squatter, victim],
			'conectize-prod',
		)
		expect(picked).toEqual({ ok: false, reason: 'collision' })
	})

	it('não escolhe o primeiro match em colisão', () => {
		const picked = pickEvolutionHubByInstanceName(
			[squatter, victim],
			'conectize-prod',
		)
		expect(
			picked.ok === true ? picked.hub.organization_id : picked.reason,
		).toBe('collision')
	})
})
