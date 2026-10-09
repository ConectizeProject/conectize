'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { buildPortalAuthCallbackUrl } from '@/lib/auth/callback-url'
import { getAuthSiteOrigin } from '@/lib/auth/site-origin'
import { reserveSignupIp } from '@/lib/auth/reserve-signup-ip'
import { useSupabaseBrowserClient } from '@/lib/supabase/use-supabase-browser-client'

type Props = {
  orgSlug: string
  refOs: string
}

export function CadastroClienteGoogleButton ({ orgSlug, refOs }: Props) {
  const supabase = useSupabaseBrowserClient()
  const [loading, setLoading] = useState(false)

  async function handleGoogleSignup () {
    if (loading) return
    setLoading(true)
    try {
      if (!supabase) {
        window.location.href = `/cadastro-cliente?org=${encodeURIComponent(orgSlug)}&ref_os=${encodeURIComponent(refOs)}&error=config`
        return
      }

      const allowed = await reserveSignupIp()
      if (!allowed) {
        window.location.href = `/cadastro-cliente?org=${encodeURIComponent(orgSlug)}&ref_os=${encodeURIComponent(refOs)}&error=limite_ip`
        return
      }

      const redirectTo = `/portal/cadastro-cliente/vincular?org=${encodeURIComponent(orgSlug)}&ref_os=${encodeURIComponent(refOs)}`
      const callbackUrl = buildPortalAuthCallbackUrl(redirectTo, getAuthSiteOrigin())

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: callbackUrl },
      })

      if (error) {
        window.location.href = `/cadastro-cliente?org=${encodeURIComponent(orgSlug)}&ref_os=${encodeURIComponent(refOs)}&error=google_oauth`
        return
      }

      if (data?.url) {
        window.location.href = data.url
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button type='button' variant='outline' className='w-full' onClick={handleGoogleSignup} disabled={loading}>
      {loading ? 'Conectando com Google…' : 'Cadastrar com Google'}
    </Button>
  )
}
