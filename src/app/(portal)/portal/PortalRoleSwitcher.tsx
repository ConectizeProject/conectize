'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const MASTER_ROLE_VALUE = 'platform_admin'

const ROLE_OPTIONS = [
  { value: MASTER_ROLE_VALUE, label: 'Master' },
  { value: 'admin', label: 'Admin' },
  { value: 'staff', label: 'Staff' },
  { value: 'retailer', label: 'Lojista' },
  { value: 'user', label: 'Cliente' },
]

type Props = {
  role: string
  simulatedRole?: string | null
}

export function PortalRoleSwitcher ({ role, simulatedRole }: Props) {
  const router = useRouter()
  const [value, setValue] = useState(simulatedRole || role || MASTER_ROLE_VALUE)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setValue(simulatedRole || role || MASTER_ROLE_VALUE)
  }, [role, simulatedRole])

  const onChange = useCallback(
    async (nextRole: string) => {
      if (!nextRole || nextRole === value) return
      setBusy(true)
      try {
        const res = await fetch('/api/portal/platform/simulated-role', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: nextRole === MASTER_ROLE_VALUE ? null : nextRole,
          }),
        })
        if (!res.ok) return
        setValue(nextRole)
        router.refresh()
      } finally {
        setBusy(false)
      }
    },
    [router, value],
  )

  return (
    <div className="flex items-center gap-2 min-w-0 max-w-[180px] sm:max-w-[220px]">
      <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <Select value={value} onValueChange={onChange} disabled={busy}>
        <SelectTrigger className="h-9 text-xs sm:text-sm">
          <SelectValue placeholder="Perfil" />
        </SelectTrigger>
        <SelectContent>
          {ROLE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
