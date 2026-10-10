self.addEventListener('push', (event) => {
	let payload = { title: 'Novo agendamento', body: '', url: '/portal/ordens', tag: 'agendamento' }
	try {
		payload = { ...payload, ...(event.data ? event.data.json() : {}) }
	} catch {
		payload.body = event.data ? event.data.text() : ''
	}
	const tag = payload.tag || 'agendamento'
	event.waitUntil((async () => {
		await self.registration.showNotification(payload.title, {
			body: payload.body,
			tag,
			renotify: false,
			data: { url: payload.url || '/portal/ordens' },
		})
		const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
		for (const client of windows) {
			client.postMessage({ type: 'staff-notices-refresh' })
		}
	})())
})

self.addEventListener('notificationclick', (event) => {
	event.notification.close()
	const url = event.notification.data?.url || '/portal/ordens'
	event.waitUntil(self.clients.openWindow(url))
})
