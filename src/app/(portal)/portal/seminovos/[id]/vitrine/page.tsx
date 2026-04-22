import { redirect } from 'next/navigation'

type Props = {
  params: Promise<{ id: string }>
}

export default async function SeminovosVitrineLegacyRedirect ({ params }: Props) {
  const { id } = await params
  redirect(`/portal/revendaaparelhos/${id}/vitrine`)
}
