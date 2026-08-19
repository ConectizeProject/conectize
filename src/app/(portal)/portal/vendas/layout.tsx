import { VendasModuleTabs } from '@/app/(portal)/portal/vendas/VendasModuleTabs'

export default function VendasLayout ({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className='space-y-4 py-4'>
      <VendasModuleTabs />
      {children}
    </div>
  )
}
