import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET (request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const redirectTo = url.searchParams.get('redirectTo') || '/portal'

  if (code) {
    const supabase = await createSupabaseServerClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  const safeRedirectTo = redirectTo.startsWith('/portal') ? redirectTo : '/portal'
  return NextResponse.redirect(new URL(safeRedirectTo, url.origin))
}

