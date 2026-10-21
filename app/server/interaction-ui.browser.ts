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
  balanceOf: vi.fn(async () => 50000),
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

describe('Teampot interaction prerequisites', () => {
  it('verifies phone and desktop actions, scroll containment and motion', async () => {
    const browser = await chromium.launch({ channel: 'chrome' })
    mkdirSync('../work/interaction-polish/screenshots', { recursive: true })
    try {
      for (const width of [375, 1280]) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
        const page = await context.newPage()
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(e.message))
        await page.route('**/_vercel/**', (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }))
        const login = async (id: string) => {
          await context.request.post(`${base}/api/auth/demo`, { data: { personId: id } })
          await page.goto(`${base}/app`)
          await page.evaluate((id) => { localStorage.setItem('tp-viewer', id); sessionStorage.removeItem('tp-state') }, id)
          await page.reload()
          await page.locator('.role-layout').waitFor()
        }
        await login('jordan')
        const nav = width < 900 ? '.bottom-tabs' : '.side-nav nav'
        expect(await page.evaluate(() => getComputedStyle(document.documentElement).overscrollBehaviorY)).toBe('none')
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        const bottomGap = await page.evaluate(() => {
          const mainBottom = document.querySelector('.role-page main')!.getBoundingClientRect().bottom + scrollY
          const padding = parseFloat(getComputedStyle(document.querySelector('.role-page')!).paddingBottom)
          return document.documentElement.scrollHeight - Math.max(innerHeight, mainBottom + padding)
        })
        expect(bottomGap).toBeLessThanOrEqual(1)
        await page.screenshot({ path: `../work/interaction-polish/screenshots/home-${width}.png`, fullPage: true })
        await page.emulateMedia({ reducedMotion: 'no-preference' })
        const token = page.locator('.token-0')
        const before = await token.evaluate((el) => getComputedStyle(el).transform)
        await page.locator('.next .round-btn').first().focus()
        await page.waitForTimeout(500)
        expect(await token.evaluate((el) => getComputedStyle(el).transform)).not.toBe(before)
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await page.locator('.gl-icon').focus()
        await page.keyboard.press('Enter')
        await page.locator('.task-card').waitFor()
        expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden')
        await page.getByRole('button', { name: 'Done', exact: true }).first().click()
        await page.locator(`${nav} button`, { hasText: 'Payday' }).click()
        const run = page.getByRole('button', { name: 'Run payday', exact: true })
        expect(await run.isDisabled()).toBe(true)
        const choices = page.locator('.payroll-options input')
        await choices.nth(0).check()
        expect(await run.isDisabled()).toBe(true)
        await choices.nth(1).check()
        expect(await run.isEnabled()).toBe(true)
        expect(await page.locator('.recipient-stack>span').count()).toBe(2)
        expect(await page.locator('.recipient-stack>span').first().evaluate((el) => getComputedStyle(el).animationName)).toBe('none')
        await run.click()
        await page.getByRole('dialog', { name: 'Run payday?', exact: true }).waitFor()
        await page.getByRole('button', { name: 'Cancel', exact: true }).click()
        await choices.nth(1).uncheck()
        expect(await run.isDisabled()).toBe(true)
        await page.getByRole('button', { name: 'Select all', exact: true }).click()
        expect(await run.isEnabled()).toBe(true)
        await page.screenshot({ path: `../work/interaction-polish/screenshots/payday-${width}.png`, fullPage: true })
        await page.getByRole('button', { name: 'Clear selection', exact: true }).click()
        expect(await run.isDisabled()).toBe(true)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        await login('sam')
        await page.getByRole('button', { name: 'Send', exact: true }).first().click()
        await page.getByLabel('Teampot username').fill('@ava')
        await page.locator('.payee').waitFor()
        await page.getByRole('textbox', { name: 'Amount', exact: true }).fill('50001')
        expect(await page.getByRole('button', { name: /^Send \$/ }).isDisabled()).toBe(true)
        await page.getByRole('textbox', { name: 'Amount', exact: true }).fill('20')
        expect(await page.getByRole('button', { name: /^Send \$/ }).isEnabled()).toBe(true)
        await page.getByLabel('Teampot username').fill('@not-a-person')
        expect(await page.getByRole('button', { name: /^Send \$/ }).isDisabled()).toBe(true)
        await page.getByRole('button', { name: 'Cancel', exact: true }).click()
        await page.locator(`${nav} button`, { hasText: 'Invest' }).click()
        const buy = page.getByRole('button', { name: /^Buy \$/ })
        await page.locator('.trade-form input').fill('50001')
        expect(await buy.isDisabled()).toBe(true)
        await page.locator('.trade-form input').fill('20')
        expect(await buy.isEnabled()).toBe(true)
        await page.getByRole('tab', { name: 'Sell', exact: true }).click()
        expect(await page.getByRole('button', { name: 'Sell', exact: true }).isDisabled()).toBe(true)
        await page.getByRole('tab', { name: 'Each payday', exact: true }).click()
        await page.getByLabel('Share of payday').fill('101')
        expect(await page.getByRole('button', { name: 'Save', exact: true }).isDisabled()).toBe(true)
        await page.getByLabel('Share of payday').fill('0')
        expect(await page.getByRole('button', { name: 'Save', exact: true }).isEnabled()).toBe(true)
        await page.screenshot({ path: `../work/interaction-polish/screenshots/invest-${width}.png`, fullPage: true })
        await login('mateo')
        await page.getByRole('button', { name: /Send an invoice|New invoice/ }).first().click()
        await page.getByLabel('What for').fill('   ')
        expect(await page.getByRole('button', { name: /^Send invoice/ }).isDisabled()).toBe(true)
        await page.getByLabel('What for').fill('Brand illustrations')
        expect(await page.getByRole('button', { name: /^Send invoice/ }).isEnabled()).toBe(true)
        expect(errors).toEqual([])
        await context.close()
      }
    } finally { await browser.close() }
    console.log('INTERACTION_UI_OK')
  }, 90000)
})
