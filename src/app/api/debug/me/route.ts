import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createSupabaseServerClient()

  const { data: userData, error: userError } = await supabase.auth.getUser()
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

  const user = userData?.user || null

  const { data: appUser, error: appUserError } = user
    ? await supabase
      .from('users')
      .select('id, email, role, created_at, updated_at, full_name')
      .eq('id', user.id)
      .maybeSingle()
    : { data: null, error: null }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || null

  return NextResponse.json({
    supabaseUrl: url,
    auth: {
      user: user ? { id: user.id, email: user.email } : null,
      userError: userError ? { message: userError.message } : null,
      hasSession: Boolean(sessionData?.session),
      sessionError: sessionError ? { message: sessionError.message } : null,
    },
    usersRow: appUser || null,
    usersRowError: appUserError
      ? { code: (appUserError as any).code || null, message: appUserError.message, details: (appUserError as any).details || null }
      : null,
    profilesRow: null,
    profileError: null,
  })
}

