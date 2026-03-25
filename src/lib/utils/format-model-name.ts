/**
 * Converte um slug de modelo para um nome de exibição formatado
 * Corrige especificamente "iphone" para "iPhone", "ipad" para "iPad", "macbook" para "MacBook"
 */
export function formatModelName (slug: string): string {
  const words = slug.split('-')
  
  const specialWords: Record<string, string> = {
    iphone: 'iPhone',
    ipad: 'iPad',
    macbook: 'MacBook',
    watch: 'Watch',
    galaxy: 'Galaxy',
    moto: 'Moto',
    poco: 'POCO',
    redmi: 'Redmi',
    xiaomi: 'Xiaomi'
  }
  
  return words.map((word, _index) => {
    const lowerWord = word.toLowerCase()
    
    // Verificar se é uma palavra especial
    if (specialWords[lowerWord]) {
      return specialWords[lowerWord]
    }
    
    // Se for um número, manter como está
    if (!isNaN(Number(word))) {
      return word
    }
    
    // Primeira letra maiúscula
    return word.charAt(0).toUpperCase() + word.slice(1)
  }).join(' ')
}

