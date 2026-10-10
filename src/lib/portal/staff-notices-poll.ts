'use client'

export type StaffNotice = {
  id: string
  title: string
  body: string
  href: string | null
  created_at?: string
}

const POLL_MS = 300_000

type Listener = (notices: StaffNotice[]) => void

const listeners = new Set<Listener>()
let timer: ReturnType<typeof setInterval> | null = null
let latest: StaffNotice[] = []
let ambientBound = false

function publish () {
  for (const listener of listeners) listener(latest)
}

function onVisibilityChange () {
  if (document.visibilityState !== 'visible') return
  void loadNotices()
}

function onServiceWorkerMessage (event: MessageEvent) {
  if (event.data?.type !== 'staff-notices-refresh') return
  void loadNotices()
}

function bindAmbientListeners () {
  if (ambientBound || typeof window === 'undefined') return
  ambientBound = true
  document.addEventListener('visibilitychange', onVisibilityChange)
  navigator.serviceWorker?.addEventListener('message', onServiceWorkerMessage)
}

function unbindAmbientListeners () {
  if (!ambientBound || typeof window === 'undefined') return
  ambientBound = false
  document.removeEventListener('visibilitychange', onVisibilityChange)
  navigator.serviceWorker?.removeEventListener('message', onServiceWorkerMessage)
}

export function refreshStaffNotices () {
  return loadNotices()
}

async function loadNotices () {
  try {
    const response = await fetch('/api/portal/staff-notifications')
    if (!response.ok) return
    const payload = await response.json() as { notifications?: StaffNotice[] }
    latest = payload.notifications ?? []
    publish()
  } catch {
    // mantém a lista atual; o próximo ciclo tenta de novo
  }
}

export function subscribeStaffNotices (listener: Listener) {
  listeners.add(listener)
  listener(latest)
  if (listeners.size === 1) {
    bindAmbientListeners()
    void loadNotices()
    timer = setInterval(() => { void loadNotices() }, POLL_MS)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
      unbindAmbientListeners()
    }
  }
}

export function forgetStaffNotice (id: string) {
  latest = latest.filter((notice) => notice.id !== id)
  publish()
}
