const urls = [
  'http://localhost:3000/loja/bateria-iphone',
  'http://localhost:3000/loja/vidro-traseiro-iphone',
  'http://localhost:3000/loja',
  'http://localhost:3000/contato',
]

for (const url of urls) {
  const res = await fetch(url)
  const html = await res.text()
  const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1]
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) =>
    m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  )
  const wa = [...html.matchAll(/https:\/\/wa\.me\/5531986140889[^"'\\\s]*/g)]
  const imgs = [...html.matchAll(/\/loja\/[^"'\\\s]+\.(?:webp|png|jpg)/g)]
  console.log('\n==', url, res.status)
  console.log('title:', title)
  console.log('h1:', h1s)
  console.log('wa unique:', [...new Set(wa.map((m) => decodeURIComponent(m[0].replace(/&amp;/g, '&'))))])
  console.log('imgs:', [...new Set(imgs.map((m) => m[0]))])
  const six = html.includes('Pronto em cerca de 6 horas')
  const pickup = html.includes('Retire na loja em Santa Efigênia')
  const garantia = /garantia/i.test(html)
  console.log('sixHours:', six, 'pickup:', pickup, 'hasGarantiaWord:', garantia)
}
