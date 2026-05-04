import { getLabelWindowFeatures } from '@/lib/ordem-print'
import {
  buildSeminovoLabelHtml,
  type SeminovoActionDevice,
} from '@/lib/seminovos/seminovos-device-actions'
import { toast } from '@/hooks/use-toast'

export async function copyTextWithPortalToast (text: string): Promise<void> {
  const t = String(text ?? '').trim()
  if (!t) return
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(t)
      toast({
        description: 'Copiado para a área de transferência',
        duration: 2000,
      })
    }
  } catch {
    // ignore clipboard errors
  }
}

export function printResaleDeviceLabel (d: SeminovoActionDevice): void {
  if (typeof window === 'undefined') return
  const win = window.open('', '_blank', getLabelWindowFeatures())
  if (!win) return
  const html = buildSeminovoLabelHtml(d)
  win.document.open()
  win.document.write(html)
  win.document.close()
}

export async function copyImeiWithPortalToast (
  imei: string | null | undefined,
): Promise<void> {
  const t = String(imei ?? '').trim()
  if (!t) {
    toast({
      description: 'Sem IMEI cadastrado para este aparelho.',
      variant: 'destructive',
      duration: 2500,
    })
    return
  }
  await copyTextWithPortalToast(t)
}
