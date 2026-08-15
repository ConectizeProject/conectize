import Link from 'next/link'
import type { SupabasePlatformStatusBanner } from '@/lib/supabase/platform-status'

type SupabaseLoginStatusNoticeProps = {
  status: SupabasePlatformStatusBanner
}

export function SupabaseLoginStatusNotice ({ status }: SupabaseLoginStatusNoticeProps) {
  return (
    <p
      role="status"
      className="mb-3 text-center text-[11px] leading-relaxed text-muted-foreground/80"
    >
      Instabilidade nos serviços de autenticação
      {status.detail ? ` — ${status.detail}` : ''}.{' '}
      <Link
        href={status.statusPageHref}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-muted-foreground"
      >
        Status
      </Link>
    </p>
  )
}
