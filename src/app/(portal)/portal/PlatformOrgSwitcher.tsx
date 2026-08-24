'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Building2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

type OrgRow = { id: string; slug: string; name: string | null; is_host: boolean }

type Props = {
  organizations: OrgRow[]
  activeOrganizationId: string | null
  variant?: 'default' | 'menu'
}

export function PlatformOrgSwitcher ({
  organizations,
  activeOrganizationId,
  variant = 'default',
}: Props) {
  const router = useRouter()
  const [value, setValue] = useState(activeOrganizationId ?? '')
  const [busy, setBusy] = useState(false)
  const isMenu = variant === 'menu'

  useEffect(() => {
    setValue(activeOrganizationId ?? '')
  }, [activeOrganizationId])

  const onChange = useCallback(
    async (organizationId: string) => {
      if (!organizationId || organizationId === activeOrganizationId) return
      setBusy(true)
      try {
        const res = await fetch('/api/portal/platform/active-organization', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId }),
        })
        if (!res.ok) return
        setValue(organizationId)
        router.refresh()
      } finally {
        setBusy(false)
      }
    },
    [activeOrganizationId, router],
  )

  if (organizations.length === 0) return null

  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-2',
        isMenu ? 'w-full flex-col items-stretch gap-1.5' : 'max-w-[220px] sm:max-w-xs',
      )}
    >
      {isMenu ? (
        <p className="flex items-center gap-1.5 px-0.5 text-xs font-medium text-muted-foreground">
          <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Empresa
        </p>
      ) : (
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      )}
      <Select
        value={value || activeOrganizationId || undefined}
        onValueChange={onChange}
        disabled={busy}
      >
        <SelectTrigger className={cn('h-9 text-xs sm:text-sm', isMenu && 'w-full')}>
          <SelectValue placeholder="Empresa" />
        </SelectTrigger>
        <SelectContent>
          {organizations.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name || o.slug}
              {o.is_host ? ' (matriz)' : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
