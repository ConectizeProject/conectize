import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/portal-api'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { CONECTIZE_HOST_ORGANIZATION_ID } from '@/lib/organizations/constants'
import { getCronRunDayBrt } from '@/lib/cron/cron-job-dedup'
import {
  runSeminovosLojistasWhatsappBroadcast,
  SEMINOVOS_LOJISTAS_BROADCAST_JOB_KEY,
} from '@/lib/seminovos/scheduled-lojistas-whatsapp-broadcast'

export const dynamic = 'force-dynamic'

type CronRunRow = {
  run_day: string
  status: 'running' | 'completed' | 'failed'
  created_at: string
  completed_at: string | null
  result: Record<string, unknown> | null
}

/** Status da rotina diária de broadcast para o grupo de lojistas (só org Conectize). */
export async function GET () {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  if (auth.organizationId !== CONECTIZE_HOST_ORGANIZATION_ID) {
    return NextResponse.json({ ok: true, available: false })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { ok: false, error: 'service_role_key_missing' },
      { status: 503 },
    )
  }

  const service = createSupabaseServiceClient()
  const { data, error } = await service
    .from('cron_job_runs')
    .select('run_day, status, created_at, completed_at, result')
    .eq('job_key', SEMINOVOS_LOJISTAS_BROADCAST_JOB_KEY)
    .order('run_day', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    available: true,
    today: getCronRunDayBrt(),
    last_run: (data as CronRunRow | null) ?? null,
  })
}

/** Executa a rotina manualmente (força envio mesmo se já rodou hoje). */
export async function POST () {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  if (auth.organizationId !== CONECTIZE_HOST_ORGANIZATION_ID) {
    return NextResponse.json({ ok: false, error: 'not_available' }, { status: 403 })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { ok: false, error: 'service_role_key_missing' },
      { status: 503 },
    )
  }

  const service = createSupabaseServiceClient()

  try {
    const result = await runSeminovosLojistasWhatsappBroadcast(service, { force: true })

    // force pula a deduplicação; registra o sucesso para o status do card e para o cron
    // das 10h não reenviar no mesmo dia. Falha manual não é registrada para não bloquear o cron.
    if (result.ok === true) {
      await service.from('cron_job_runs').upsert(
        {
          job_key: SEMINOVOS_LOJISTAS_BROADCAST_JOB_KEY,
          run_day: getCronRunDayBrt(),
          status: 'completed',
          result: { ...result, manual: true },
          completed_at: new Date().toISOString(),
        },
        { onConflict: 'job_key,run_day' },
      )
    }

    if (result.ok === false) {
      const status =
        result.error === 'whatsapp_not_configured' ||
        result.error === 'evolution_required_for_group'
          ? 503
          : 502
      return NextResponse.json(result, { status })
    }
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
