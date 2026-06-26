import type { SupabaseClient } from '@supabase/supabase-js'
import {
  acquireCronJobRun,
  completeCronJobRun,
  failCronJobRun,
  getCronRunDayBrt,
} from '@/lib/cron/cron-job-dedup'
import { CONECTIZE_HOST_ORGANIZATION_ID } from '@/lib/organizations/constants'
import { fetchSeminovosDevices } from '@/lib/seminovos/fetch-seminovos-data'
import { buildConectizeStockWhatsAppTexts } from '@/lib/seminovos/whatsapp-stock-broadcast-text'
import { isGroupWaKey } from '@/lib/whatsapp/wa-conversation-key'
import { resolveOrganizationWhatsappOutbound } from '@/lib/whatsapp/whatsapp-outbound'

/** Grupo de lojistas (atacado) — Evolution/Baileys JID. */
export const LOJISTAS_WHATSAPP_GROUP_JID = '120363406781910188@g.us'

export const SEMINOVOS_LOJISTAS_BROADCAST_JOB_KEY = 'whatsapp-seminovos-lojistas-broadcast'

function resolveLojistasGroupJid (): string {
  const fromEnv = String(process.env.WHATSAPP_LOJISTAS_GROUP_JID || '').trim()
  return fromEnv || LOJISTAS_WHATSAPP_GROUP_JID
}

export type SeminovosLojistasBroadcastResult =
  | {
      ok: true
      provider: string
      messageId: string | null
      devicesCount: number
      groupJid: string
      skipped?: false
    }
  | {
      ok: true
      skipped: true
      reason: 'already_sent_today' | 'already_running'
      runDay: string
      groupJid: string
      previousResult?: Record<string, unknown>
    }
  | {
      ok: false
      error: string
      devicesCount?: number
      groupJid?: string
    }

export type SeminovosLojistasBroadcastOptions = {
  /** Ignora deduplicação diária (útil em testes manuais). */
  force?: boolean
}

/**
 * Monta a lista atacado de seminovos e envia ao grupo de lojistas via WhatsApp (Evolution).
 */
export async function runSeminovosLojistasWhatsappBroadcast (
  supabase: SupabaseClient,
  options: SeminovosLojistasBroadcastOptions = {},
): Promise<SeminovosLojistasBroadcastResult> {
  const groupJid = resolveLojistasGroupJid()
  if (!isGroupWaKey(groupJid)) {
    return { ok: false, error: 'invalid_group_jid', groupJid }
  }

  const runDay = getCronRunDayBrt()
  const force = options.force === true

  if (!force) {
    const slot = await acquireCronJobRun(
      supabase,
      SEMINOVOS_LOJISTAS_BROADCAST_JOB_KEY,
      runDay,
    )
    if (!slot.acquired) {
      if (slot.status === 'completed') {
        return {
          ok: true,
          skipped: true,
          reason: 'already_sent_today',
          runDay,
          groupJid,
          previousResult: slot.result,
        }
      }
      return {
        ok: true,
        skipped: true,
        reason: 'already_running',
        runDay,
        groupJid,
        previousResult: slot.result,
      }
    }
  }

  const devices = await fetchSeminovosDevices(supabase, {
    q: '',
    condition: '',
    storageGb: '',
    color: '',
    purchaseDateFrom: '',
    purchaseDateTo: '',
    stockType: 'seminovo',
    organizationId: CONECTIZE_HOST_ORGANIZATION_ID,
  })

  const available = devices.filter((d) => !d.sold)
  const { atacado: body } = buildConectizeStockWhatsAppTexts(available)

  const outbound = await resolveOrganizationWhatsappOutbound(
    supabase,
    CONECTIZE_HOST_ORGANIZATION_ID,
  )

  if (!outbound) {
    const failure = {
      ok: false as const,
      error: 'whatsapp_not_configured',
      devicesCount: available.length,
      groupJid,
    }
    if (!force) {
      await failCronJobRun(supabase, SEMINOVOS_LOJISTAS_BROADCAST_JOB_KEY, runDay, failure)
    }
    return failure
  }

  if (outbound.provider !== 'evolution') {
    const failure = {
      ok: false as const,
      error: 'evolution_required_for_group',
      devicesCount: available.length,
      groupJid,
    }
    if (!force) {
      await failCronJobRun(supabase, SEMINOVOS_LOJISTAS_BROADCAST_JOB_KEY, runDay, failure)
    }
    return failure
  }

  const send = await outbound.send({
    toTarget: groupJid,
    body,
  })

  if (send.ok === false) {
    const failure = {
      ok: false as const,
      error: typeof send.error === 'string' ? send.error : 'send_failed',
      devicesCount: available.length,
      groupJid,
    }
    if (!force) {
      await failCronJobRun(supabase, SEMINOVOS_LOJISTAS_BROADCAST_JOB_KEY, runDay, failure)
    }
    return failure
  }

  const success = {
    ok: true as const,
    provider: outbound.provider,
    messageId: send.messageId ?? null,
    devicesCount: available.length,
    groupJid,
  }

  if (!force) {
    await completeCronJobRun(
      supabase,
      SEMINOVOS_LOJISTAS_BROADCAST_JOB_KEY,
      runDay,
      success,
    )
  }

  return success
}
