const BASE = (process.env.BASE || 'http://localhost:8790').replace(/\/$/, '')
process.env.PLAYWRIGHT_BROWSERS_PATH ||= './.cache/ms-playwright'
const sizes = [{ width: 375, height: 812 }, { width: 1280, height: 900 }]

async function main() {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch()
  const errors = []
  try {
    for (const size of sizes) {
      const page = await browser.newPage({ viewport: size })
      const logs = []
      page.on('console', (msg) => { if (msg.type() === 'error') logs.push(msg.text()) })
      page.on('pageerror', (err) => logs.push(err.message))
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
      await page.getByRole('link', { name: 'Open the live demo' }).click()
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

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
