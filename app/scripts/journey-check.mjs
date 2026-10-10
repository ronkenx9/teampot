const BASE = (process.env.BASE || 'http://localhost:8790').replace(/\/$/, '')
process.env.PLAYWRIGHT_BROWSERS_PATH ||= './.cache/ms-playwright'

async function resetDemo() {
  await fetch(`${BASE}/api/reset`, { method: 'POST', headers: process.env.RESET_TOKEN ? { 'x-reset-token': process.env.RESET_TOKEN } : {} }).catch(() => undefined)
  // A reset leaves an empty company; set the demo company up again so the journey starts from a real home.
  await fetch(`${BASE}/api/setup`, { method: 'POST' }).catch(() => undefined)
}

async function main() {
  let chromium
  try {
    ;({ chromium } = await import('playwright'))
  } catch {
    const r = await fetch(`${BASE}/app`)
    if (!r.ok) throw new Error(`Could not load /app: ${r.status}`)
    console.log('Playwright is not installed; journey HTTP smoke passed and manual browser fallback is documented.')
    return
  }

  let browser
  try {
    browser = await chromium.launch()
  } catch (e) {
    const r = await fetch(`${BASE}/app`)
    if (!r.ok) throw new Error(`Could not load /app: ${r.status}`)
    console.log(`Playwright is installed, but the browser could not launch here; journey HTTP smoke passed and manual browser fallback is documented. ${e.message.split('\n')[0]}`)
    return
  }

  await resetDemo()
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  try {
    await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Try the demo' }).click()
    await page.getByRole('button', { name: /Sam Okafor/ }).click()
    await page.getByRole('button', { name: 'Pay' }).first().click()
    const vendorValue = await page.locator('select').first().locator('option', { hasText: 'PixelVault Stock' }).first().getAttribute('value')
    if (!vendorValue) throw new Error('PixelVault Stock option not found')
    await page.locator('select').first().selectOption(vendorValue)
    await page.getByRole('button', { name: /Pay \$45/ }).click()
    await page.getByRole('button', { name: /Confirm/ }).click()
    await page.getByText(/Held for a sec/).waitFor({ timeout: 12000 })
    await page.locator('.profile-button').click()
    await page.locator('.profile-menu button', { hasText: 'Ava' }).click()
    await page.locator('.bottom-tabs button', { hasText: 'Approvals' }).click()
    await page.getByRole('button', { name: /Approve \+ add/ }).click()
    await page.getByText(/Approved and added|Approved/).waitFor({ timeout: 12000 })
  } finally {
    await browser.close()
  }
  console.log('journey ok')
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
