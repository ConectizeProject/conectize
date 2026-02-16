import { Suspense } from 'react'
import { LoginClient } from './LoginClient'

export default function PortalLoginPage () {
  return (
    <Suspense fallback={<div className="min-h-screen pt-32 pb-20" />}>
      <LoginClient />
    </Suspense>
  )
}

