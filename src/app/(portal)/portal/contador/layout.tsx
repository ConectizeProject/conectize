import { ContadorModuleTabs } from '@/app/(portal)/portal/contador/ContadorModuleTabs'

export default function ContadorLayout ({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className='space-y-4 py-4'>
      <ContadorModuleTabs />
      <div>{children}</div>
    </div>
  )
}
