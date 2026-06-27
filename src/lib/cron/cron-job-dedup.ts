import type { SupabaseClient } from '@supabase/supabase-js'

export type CronJobAcquireResult =
  | { acquired: true }
  | { acquired: false; status: 'completed' | 'running' | 'failed'; result?: Record<string, unknown> }

/** Data calendário em America/Sao_Paulo (YYYY-MM-DD). */
export function getCronRunDayBrt (): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/**
 * Reserva a execução do job no dia (BRT). Retorna acquired=false se já rodou/concluiu.
 */
export async function acquireCronJobRun (
  supabase: SupabaseClient,
  jobKey: string,
  runDay: string,
): Promise<CronJobAcquireResult> {
  const { error: insertError } = await supabase.from('cron_job_runs').insert({
    job_key: jobKey,
    run_day: runDay,
    status: 'running',
    result: {},
  })

  if (!insertError) {
    return { acquired: true }
  }

  if (insertError.code !== '23505') {
    throw new Error(insertError.message)
  }

  const { data: existing, error: selectError } = await supabase
    .from('cron_job_runs')
    .select('status, result')
    .eq('job_key', jobKey)
    .eq('run_day', runDay)
    .maybeSingle()

  if (selectError) {
    throw new Error(selectError.message)
  }

  const status = (existing?.status as 'completed' | 'running' | 'failed' | undefined) ?? 'running'
  const result =
    existing?.result && typeof existing.result === 'object' && !Array.isArray(existing.result)
      ? (existing.result as Record<string, unknown>)
      : undefined

  return { acquired: false, status, result }
}

export async function completeCronJobRun (
  supabase: SupabaseClient,
  jobKey: string,
  runDay: string,
  result: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from('cron_job_runs')
    .update({
      status: 'completed',
      result,
      completed_at: new Date().toISOString(),
    })
    .eq('job_key', jobKey)
    .eq('run_day', runDay)

  if (error) {
    throw new Error(error.message)
  }
}

export async function failCronJobRun (
  supabase: SupabaseClient,
  jobKey: string,
  runDay: string,
  result: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from('cron_job_runs')
    .update({
      status: 'failed',
      result,
      completed_at: new Date().toISOString(),
    })
    .eq('job_key', jobKey)
    .eq('run_day', runDay)

  if (error) {
    throw new Error(error.message)
  }
}

export async function releaseCronJobRun (
  supabase: SupabaseClient,
  jobKey: string,
  runDay: string,
): Promise<void> {
  await supabase
    .from('cron_job_runs')
    .delete()
    .eq('job_key', jobKey)
    .eq('run_day', runDay)
}
