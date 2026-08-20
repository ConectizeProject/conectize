import { REVENDA_BASE } from '@/lib/revenda/revenda-paths'
import { redirect } from 'next/navigation'

/** Legado: bookmarks / abas em `/revendaaparelhos/seminovos`. */
export default function RevendaSeminovosLegacyRedirect () {
  redirect(REVENDA_BASE)
}
