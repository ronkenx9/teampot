import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest'

const mem: { state: any } = { state: null }
const tempoCalls = { payday: 0 }

vi.mock('./store.js', () => ({
  storeKind: vi.fn(() => 'redis'),
  load: vi.fn(async () => mem.state),
  save: vi.fn(async (s: any) => { mem.state = JSON.parse(JSON.stringify(s)) }),
  withWriteLock: vi.fn(async (fn: () => Promise<unknown>) => fn()),
  waitlistAdd: vi.fn(async (e: any) => { if (wl.list.some((x: any) => x.email === e.email)) return false; wl.list.push(e); return true }),
  waitlistAll: vi.fn(async () => wl.list),
}))
const wl: { list: any[] } = { list: [] }

vi.mock('./tempo.js', () => ({
  TOKEN: '0x20c0000000000000000000000000000000000000',
  EXPLORER: 'https://records.example/',
  EXPLORER_ACCOUNT: 'https://records.example/account/',
  NETWORK: 'testnet',
  EARN_VAULT: '',
  earnPrepare: vi.fn(async (_source: any, action: string, amount: number) => { const T = await import('./tempo.js'); return () => action === 'deposit' ? T.earnDeposit(_source, amount) : T.earnWithdraw(_source, amount) }),
  earnSnapshot: vi.fn(async () => ({ balance: 0, withdrawable: 0 })),
  earnLive: vi.fn(() => false),
  earnPosition: vi.fn(async () => 0),
  earnDeposit: vi.fn(async () => `0x${'e1'.repeat(32)}`),
  earnWithdraw: vi.fn(async () => `0x${'e2'.repeat(32)}`),
  accessAccount: vi.fn((_pk: string, parent: any) => ({ address: parent?.address, head: true })),
  authorizeAdminKey: vi.fn(async () => `0x${'a1'.repeat(32)}`),
  issueKeyVia: vi.fn(async () => `0x${'2'.repeat(64)}`),
  revokeKeyVia: vi.fn(async () => `0x${'3'.repeat(64)}`),
  companyAccount: { address: '0x0000000000000000000000000000000000000001' },
  newAddress: vi.fn(() => `0x${Math.random().toString(16).slice(2).padEnd(40, '0').slice(0, 40)}`),
  derivedKeyPk: vi.fn(() => `0x${'1'.repeat(64)}`),
  derivedDepartmentRootPk: vi.fn(() => `0x${'7'.repeat(64)}`),
  derivedPersonalRootPk: vi.fn(() => `0x${'9'.repeat(64)}`),
  derivedPersonalAddress: vi.fn((_epoch: string, id: string) => `0x${Buffer.from(id).toString('hex').padEnd(40, '0').slice(0, 40)}`),
  p256RootAddress: vi.fn(() => `0x${'8'.repeat(40)}`),
  rootFromPk: vi.fn(() => ({ address: `0x${'8'.repeat(40)}` })),
  issueKey: vi.fn(async () => `0x${'2'.repeat(64)}`),
  issueKeyOn: vi.fn(async () => `0x${'2'.repeat(64)}`),
  revokeKey: vi.fn(async () => `0x${'3'.repeat(64)}`),
  revokeKeyOn: vi.fn(async () => `0x${'3'.repeat(64)}`),
  remaining: vi.fn(async () => ({ remaining: 100, periodEnd: 1800000000 })),
  remainingOn: vi.fn(async () => ({ remaining: 100, periodEnd: 1800000000 })),
  balanceOf: vi.fn(async () => 1000),
  tokenBalance: vi.fn(async () => 10),
  createTip20: vi.fn(async (_name: string, symbol: string) => ({ tokenAddress: `0x${Buffer.from(symbol).toString('hex').padEnd(40, '0').slice(0, 40)}`, tx: `0x${'a'.repeat(64)}` })),
  mintToken: vi.fn(async () => `0x${'b'.repeat(64)}`),
  createDexPair: vi.fn(async () => `0x${'c'.repeat(64)}`),
  placeStockOrders: vi.fn(async () => ({ bidTx: `0x${'d'.repeat(64)}`, askTx: `0x${'e'.repeat(64)}` })),
  dexBuyWithAccount: vi.fn(async () => `0x${'f'.repeat(64)}`),
  dexSellWithAccount: vi.fn(async () => `0x${'0'.repeat(64)}`),
  tryDeployEarn: vi.fn(async () => { throw new Error('No public pathUSD ERC-4626 venue/factory configuration is available for Moderato in this app.') }),
  spendWithKey: vi.fn(async () => `0x${'4'.repeat(64)}`),
  spendWithKeyOn: vi.fn(async () => `0x${'4'.repeat(64)}`),
  companyPay: vi.fn(async () => `0x${'5'.repeat(64)}`),
  payFrom: vi.fn(async () => `0x${'5'.repeat(64)}`),
  payday: vi.fn(async () => ({ tx: `0x${'6'.repeat(64)}`, ms: 250, status: 'success', n: ++tempoCalls.payday })),
  paydayFrom: vi.fn(async () => ({ tx: `0x${'6'.repeat(64)}`, ms: 250, status: 'success' })),
  verifySpend: vi.fn(async () => true),
}))



import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
let server: ReturnType<typeof serve>
let base: string
beforeAll(async () => {
  const { app } = await import('./app.js')
  app.use('/*', serveStatic({ root: './web/dist' }))
  app.get('*', serveStatic({ path: './web/dist/index.html' }))
  await app.request('/api/auth/demo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ personId: 'jordan' }) })
  mem.state.seeded = true
  server = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' })
  await new Promise<void>((resolve) => server.on('listening', resolve))
  base = `http://127.0.0.1:${(server.address() as any).port}`
})
afterAll(() => new Promise<void>((resolve) => server ? server.close(() => resolve()) : resolve()))

describe('Privacy and surplus browser controls', () => {
  it('exercises real API policy changes and blocked payroll at phone and desktop sizes', async () => {
    const browser = await chromium.launch()
    mkdirSync('../work/privacy-earn/screenshots', { recursive: true })
    try {
      for (const width of [375, 1280]) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
        const page = await context.newPage()
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(e.stack || e.message))
        await page.route('**/_vercel/**', (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }))
        await context.request.post(`${base}/api/auth/demo`, { data: { personId: 'jordan' } })
        await page.addInitScript(() => localStorage.setItem('tp-viewer', 'jordan'))
        await page.goto(`${base}/app`)
        await page.locator('.role-layout').waitFor()
        const nav = width < 900 ? '.bottom-tabs' : '.side-nav nav'
        await page.locator(`${nav} button`, { hasText: 'Payday' }).click()
        await page.getByRole('button', { name: 'Require confidential payroll', exact: true }).click()
        await page.getByText('Confidential payroll is unavailable:', { exact: false }).waitFor()
        expect(await page.getByRole('button', { name: 'Run payday', exact: true }).isDisabled()).toBe(true)
        expect(tempoCalls.payday).toBe(0)
        await page.screenshot({ path: `../work/privacy-earn/screenshots/privacy-${width}.png`, fullPage: true })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        const publicBtn = page.getByRole('button', { name: 'Use public payroll', exact: true })
        expect(await publicBtn.isDisabled()).toBe(true)
        await page.getByLabel('I understand public payments expose payroll details on the blockchain.').check()
        await publicBtn.click()
        await page.getByRole('button', { name: 'Require confidential payroll', exact: true }).waitFor()
        await page.locator(`${nav} button`, { hasText: 'Departments' }).click()
        const earn = page.getByRole('region', { name: 'Design surplus earn', exact: true })
        await earn.getByRole('button', { name: 'Manage earn', exact: true }).click()
        await earn.getByLabel('Design cash reserve').fill('500')
        await earn.getByLabel('Allow surplus deposits', { exact: true }).check()
        expect(await earn.getByRole('button', { name: 'Save reserve policy' }).isDisabled()).toBe(true)
        await earn.getByLabel('I understand returns and withdrawal availability are not guaranteed.').check()
        await earn.getByRole('button', { name: 'Save reserve policy' }).click()
        await page.getByText('Reserve policy saved', { exact: true }).waitFor()
        await earn.getByLabel('Design earn amount').fill('500')
        expect(await earn.getByRole('button', { name: 'Simulate deposit' }).isDisabled()).toBe(true)
        await earn.getByLabel('Design earn amount').fill('100')
        await earn.getByRole('button', { name: 'Simulate deposit' }).click()
        await earn.getByText('$100 simulated', { exact: true }).waitFor()
        await earn.screenshot({ path: `../work/privacy-earn/screenshots/earn-${width}.png` })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        await earn.getByRole('button', { name: 'Simulate withdrawal' }).click()
        await earn.getByText('$0 simulated', { exact: true }).waitFor()
        // Reset the policy so both viewport runs exercise the same opt-in boundary.
        await earn.getByLabel('Allow surplus deposits', { exact: true }).uncheck()
        await earn.getByRole('button', { name: 'Save reserve policy' }).click()
        await page.getByText('Deposits paused. Finance must approve a reserve policy.', { exact: false }).waitFor()
        expect(errors).toEqual([])
        await context.close()
      }
    } finally { await browser.close() }
    console.log('PRIVACY_EARN_UI_OK')
  }, 60000)
})
