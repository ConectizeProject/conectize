'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type Notice = {
	id: string
	title: string
	body: string
	href: string | null
}

function urlBase64ToUint8Array (base64String: string) {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
	const raw = window.atob(base64)
	const output = new Uint8Array(raw.length)
	for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
	return output
}

export function AppointmentAlerts () {
	const [items, setItems] = useState<Notice[]>([])
	const [askPush, setAskPush] = useState(false)
	const seenRef = useRef(new Set<string>())

	useEffect(() => {
		if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
			setAskPush(true)
		}
		let stopped = false

		async function load () {
			try {
				const response = await fetch('/api/portal/staff-notifications')
				if (!response.ok) return
				const payload = await response.json() as { notifications?: Notice[] }
				const next = payload.notifications ?? []
				for (const item of next) {
					if (seenRef.current.has(item.id)) continue
					seenRef.current.add(item.id)
					if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
						const note = new Notification(item.title, { body: item.body })
						note.onclick = () => {
							window.location.assign(item.href || '/portal/ordens')
						}
					}
				}
				if (!stopped) setItems(next)
			} catch {
				// portal segue sem o aviso se a rede falhar
			}
		}

		void load()
		const timer = window.setInterval(() => { void load() }, 15000)
		return () => {
			stopped = true
			window.clearInterval(timer)
		}
	}, [])

	async function dismiss (id: string) {
		setItems((current) => current.filter((item) => item.id !== id))
		await fetch('/api/portal/staff-notifications', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ id }),
		})
	}

	async function enablePush () {
		if (typeof Notification === 'undefined') return
		const permission = await Notification.requestPermission()
		setAskPush(false)
		if (permission !== 'granted' || !('serviceWorker' in navigator)) return
		const keyResponse = await fetch('/api/portal/push-subscriptions')
		const payload = await keyResponse.json() as { publicKey?: string }
		const publicKey = String(payload.publicKey || '').trim()
		if (!publicKey) return
		const registration = await navigator.serviceWorker.register('/sw-agendamento.js')
		const subscription = await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: urlBase64ToUint8Array(publicKey),
		})
		await fetch('/api/portal/push-subscriptions', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(subscription),
		})
	}

	if (!askPush && items.length === 0) return null

	return (
		<div className="fixed bottom-4 right-4 z-50 flex w-[min(100%-2rem,22rem)] flex-col gap-2">
			{askPush ? (
				<div className="rounded-xl border bg-background p-3 shadow-lg">
					<p className="text-sm font-medium">Avisos de agendamento</p>
					<p className="mt-1 text-xs text-muted-foreground">
						Receba um aviso neste navegador quando um cliente agendar.
					</p>
					<div className="mt-2 flex gap-2">
						<button type="button" className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground" onClick={() => { void enablePush() }}>
							Ativar
						</button>
						<button type="button" className="rounded-md px-3 py-1.5 text-xs" onClick={() => setAskPush(false)}>
							Agora não
						</button>
					</div>
				</div>
			) : null}
			{items.map((item) => (
				<div key={item.id} className="rounded-xl border bg-background p-3 shadow-lg">
					<p className="text-sm font-semibold">{item.title}</p>
					<p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
					<div className="mt-2 flex items-center justify-between gap-2">
						<Link href={item.href || '/portal/ordens'} className="text-sm font-medium underline-offset-4 hover:underline">
							Abrir OS
						</Link>
						<button type="button" className="text-sm" onClick={() => { void dismiss(item.id) }}>
							Fechar
						</button>
					</div>
				</div>
			))}
		</div>
	)
}
