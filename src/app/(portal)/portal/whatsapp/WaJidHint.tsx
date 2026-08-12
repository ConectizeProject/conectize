export function WaJidHint ({ waFrom }: { waFrom: string }) {
  const jid = String(waFrom || '').trim()
  if (!jid) return null
  return (
    <p
      className="truncate font-mono text-[10px] leading-tight text-[#667781] dark:text-[#8696a0]"
      title={jid}
    >
      {jid}
    </p>
  )
}
