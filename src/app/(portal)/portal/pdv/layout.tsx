export default function PdvLayout ({ children }: { children: React.ReactNode }) {
  return (
    <div className='flex h-full min-h-[calc(100dvh-7rem)] flex-1 flex-col overflow-hidden'>
      {children}
    </div>
  )
}
