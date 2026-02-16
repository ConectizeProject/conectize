import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export function GET () {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return NextResponse.json({
    hasUrl: Boolean(url),
    url: url || null,
    hasAnonKey: Boolean(anonKey),
    anonKeyPreview: anonKey ? `${anonKey.slice(0, 12)}…${anonKey.slice(-6)}` : null,
    anonKeyLength: anonKey ? anonKey.length : 0,
    nodeEnv: process.env.NODE_ENV,
  })
}

