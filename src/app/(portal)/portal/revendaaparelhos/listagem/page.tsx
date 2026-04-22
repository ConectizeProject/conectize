import { REVENDA_BASE } from '@/lib/revenda/revenda-paths'
import { redirect } from 'next/navigation'

/** Legado: bookmarks em `/revendaaparelhos/listagem`. */
export default function RevendaListagemLegacyRedirect () {
  redirect(REVENDA_BASE)
}
