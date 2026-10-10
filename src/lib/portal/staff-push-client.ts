'use client'

function urlBase64ToUint8Array (base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

export function readPushPermission (): NotificationPermission | 'unsupported' {
  if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) return 'unsupported'
  return Notification.permission
}

export async function syncStaffPushSubscription () {
  if (readPushPermission() !== 'granted') return false
  const keyResponse = await fetch('/api/portal/push-subscriptions')
  const payload = await keyResponse.json() as { publicKey?: string }
  const publicKey = String(payload.publicKey || '').trim()
  if (!publicKey) return false
  const registration = await navigator.serviceWorker.register('/sw-agendamento.js')
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  })
  const save = await fetch('/api/portal/push-subscriptions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(subscription),
  })
  return save.ok
}

export async function enableStaffPush () {
  if (readPushPermission() === 'unsupported') return 'unsupported' as const
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission
  const ok = await syncStaffPushSubscription()
  return ok ? 'granted' as const : 'failed' as const
}
