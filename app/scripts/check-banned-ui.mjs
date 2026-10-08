import { readFileSync } from 'node:fs'

const banned = ['wallet', 'gas', 'token', 'blockchain', 'chain', 'stablecoin', 'seed phrase', 'private key', 'address', 'tx hash']
const source = readFileSync(new URL('../web/src/App.tsx', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '')

const visible = []
for (const m of source.matchAll(/>([^<>{}][^<>{}]*)</g)) visible.push(m[1])
for (const m of source.matchAll(/(?:aria-label|title|placeholder)=["']([^"']+)["']/g)) visible.push(m[1])
for (const m of source.matchAll(/`([^`]*\s[^`]*)`|'([^']*\s[^']*)'|"([^"]*\s[^"]*)"/g)) {
  const s = m[1] || m[2] || m[3] || ''
  if (!/^https?:|^\/api\//.test(s) && !/[{}]/.test(s)) visible.push(s)
}

const haystack = visible.join('\n').toLowerCase()
const hits = banned.filter((word) => new RegExp(`\\b${word.replace(/\s+/g, '\\s+')}\\b`, 'i').test(haystack))
if (hits.length) {
  console.error(`Banned user-visible words found: ${hits.join(', ')}`)
  process.exit(1)
}
console.log('No banned user-visible words found.')
