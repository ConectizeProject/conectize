/**
 * Converte um slug de modelo para um nome de exibição formatado
 * Corrige especificamente "iphone" para "iPhone", "ipad" para "iPad", "macbook" para "MacBook"
 */
export function formatCpfCnpj(value: string): string {
  const onlyDigits = (value: string) => {
    return String(value || '').replace(/\D/g, '')
  }

  const formatCpf = (value: string) => {
    const digits = onlyDigits(value).slice(0, 11)
    const p1 = digits.slice(0, 3)
    const p2 = digits.slice(3, 6)
    const p3 = digits.slice(6, 9)
    const p4 = digits.slice(9, 11)
    const head = [p1, p2, p3].filter(Boolean).join('.')
    if (p4) return `${head}-${p4}`
    return head || ''
  }

  const formatCnpj = (value: string) => {
    const digits = onlyDigits(value).slice(0, 14)
    const p1 = digits.slice(0, 2)
    const p2 = digits.slice(2, 5)
    const p3 = digits.slice(5, 8)
    const p4 = digits.slice(8, 12)
    const p5 = digits.slice(12, 14)

    const head = [p1, p2, p3].filter(Boolean).join('.')
    if (!head) return ''

    if (p4) {
      if (p5) return `${head}/${p4}-${p5}`
      return `${head}/${p4}`
    }
    return head
  }

  const digits = onlyDigits(value).slice(0, 14)
  if (digits.length <= 11) return formatCpf(digits)
  return formatCnpj(digits)
}

