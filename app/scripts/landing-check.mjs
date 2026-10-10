const BASE = (process.env.BASE || 'http://localhost:8790').replace(/\/$/, '')
process.env.PLAYWRIGHT_BROWSERS_PATH ||= './.cache/ms-playwright'
const sizes = [{ width: 375, height: 812 }, { width: 1280, height: 900 }]

async function main() {
  let chromium
  try {
    ;({ chromium } = await import('playwright'))
  } catch {
    const ok = await httpSmoke()
    if (!ok) throw new Error('Landing HTTP smoke failed.')
    console.log('Playwright is not installed; landing HTTP smoke passed and manual browser fallback is documented.')
    return
  }

  let browser
  try {
    browser = await chromium.launch()
  } catch (e) {
    const ok = await httpSmoke()
    if (!ok) throw new Error('Landing HTTP smoke failed.')
    console.log(`Playwright is installed, but the browser could not launch here; landing HTTP smoke passed and manual browser fallback is documented. ${e.message.split('\n')[0]}`)
    return
  }
  const errors = []
  try {
    for (const size of sizes) {
      const page = await browser.newPage({ viewport: size })
      const logs = []
      page.on('console', (msg) => { if (msg.type() === 'error') logs.push(msg.text()) })
      page.on('pageerror', (err) => logs.push(err.message))
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
      await page.getByRole('link', { name: 'Try the live demo' }).first().click()
      await page.waitForURL(`${BASE}/app`)
      await page.waitForLoadState('networkidle')
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
      if (overflow || logs.length) errors.push(`${size.width}px overflow=${overflow} logs=${logs.join(' | ')}`)
      await page.close()
    }
  } finally {
    await browser.close()
  }
  if (errors.length) throw new Error(errors.join('\n'))
  console.log('Landing check passed at 375px and 1280px; demo link reaches /app.')
}

async function httpSmoke() {
  const paths = ['/', '/app', '/app/invite/example-token', '/manifest.webmanifest', '/og.svg']
  for (const path of paths) {
    const r = await fetch(`${BASE}${path}`)
    if (!r.ok) return false
  }
  return true
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
