self.addEventListener('push', (event) => {
	let payload = { title: 'Novo agendamento', body: '', url: '/portal/ordens' }
	try {
		payload = { ...payload, ...(event.data ? event.data.json() : {}) }
	} catch {
		payload.body = event.data ? event.data.text() : ''
	}
	event.waitUntil(self.registration.showNotification(payload.title, {
		body: payload.body,
		data: { url: payload.url || '/portal/ordens' },
	}))
})

self.addEventListener('notificationclick', (event) => {
	event.notification.close()
	const url = event.notification.data?.url || '/portal/ordens'
	event.waitUntil(self.clients.openWindow(url))
})
