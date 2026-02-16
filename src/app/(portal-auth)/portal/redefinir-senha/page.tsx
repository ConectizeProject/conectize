import { Suspense } from 'react'
import { ResetPasswordClient } from './ResetPasswordClient'

export default function RedefinirSenhaPage () {
  return (
    <Suspense fallback={<div className="min-h-screen pt-32 pb-20" />}>
      <ResetPasswordClient />
    </Suspense>
  )
}

