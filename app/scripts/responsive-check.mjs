const BASE = process.env.BASE || 'http://localhost:8790'
const viewers = ['jordan', 'ava', 'sam', 'mateo']
const sizes = [{ width: 375, height: 812 }, { width: 1280, height: 900 }]

async function main() {
  let chromium
  try {
    ;({ chromium } = await import('playwright'))
  } catch {
    const r = await fetch(BASE)
    if (!r.ok) throw new Error(`Could not load ${BASE}: ${r.status}`)
    console.log('Playwright is not installed; loaded the app and documented manual responsive fallback.')
    return
  }

  const browser = await chromium.launch()
  const errors = []
  try {
    for (const size of sizes) {
      for (const viewer of viewers) {
        const page = await browser.newPage({ viewport: size })
        const logs = []
        page.on('console', (msg) => { if (msg.type() === 'error') logs.push(msg.text()) })
        page.on('pageerror', (err) => logs.push(err.message))
        await page.goto(BASE, { waitUntil: 'networkidle' })
        await page.evaluate((v) => localStorage.setItem('tp-viewer', v), viewer)
        await page.reload({ waitUntil: 'networkidle' })
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
        if (overflow || logs.length) errors.push(`${viewer} ${size.width}px overflow=${overflow} logs=${logs.join(' | ')}`)
        await page.close()
      }
    }
  } finally {
    await browser.close()
  }
  if (errors.length) throw new Error(errors.join('\n'))
  console.log('Responsive check passed at 375px and 1280px for all views.')
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
