'use server'

import { requireAdminPage } from '@/lib/auth/portal-api'
import { DadosEmpresaSubmenu } from '@/app/(portal)/portal/admin/dados-empresa/DadosEmpresaSubmenu'
import { StorageUsageClient } from '@/app/(portal)/portal/admin/armazenamento/StorageUsageClient'

export default async function StorageUsagePage () {
  await requireAdminPage()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Armazenamento</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe o uso do Supabase Storage e remova mídias antigas manualmente.
        </p>
      </div>

      <DadosEmpresaSubmenu />

      <div className="max-w-6xl">
        <StorageUsageClient />
      </div>
    </div>
  )
}
