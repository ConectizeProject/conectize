import { redirect } from 'next/navigation'
import { PORTAL_COMPLETE_PROFILE_PATH } from '@/lib/auth/portal-auth-paths'
import { getAuthUser } from '@/lib/supabase/server'
import { SignupClient } from './SignupClient'

export default async function PortalSignupPage() {
  const { user } = await getAuthUser()
  if (user) {
    redirect(PORTAL_COMPLETE_PROFILE_PATH)
  }

  return <SignupClient />
}
