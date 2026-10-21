import { beforeEach, describe, expect, it, vi } from 'vitest'

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


const post = (app: any, path: string, cookie: string, body: any = {}) => app.request(path, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body) })
const login = async (app: any, personId = 'jordan') => (await post(app, '/api/auth/demo', '', { personId })).headers.get('set-cookie')!.split(';')[0]
const state = async (app: any, cookie: string) => (await app.request('/api/state', { headers: { cookie } })).json()

beforeEach(async () => {
  mem.state = null
  tempoCalls.payday = 0
  const T = await import('./tempo.js')
  const Store = await import('./store.js')
  vi.mocked(Store.storeKind).mockReturnValue('redis')
  vi.mocked(T.earnPrepare).mockImplementation(async (source: any, action: string, amount: number) => () => action === 'deposit' ? T.earnDeposit(source, amount) : T.earnWithdraw(source, amount))
  vi.mocked(T.earnLive).mockReturnValue(false)
  vi.mocked(T.balanceOf).mockResolvedValue(1000)
  vi.mocked(T.earnSnapshot).mockResolvedValue({ balance: 100, withdrawable: 80 })
  vi.mocked(T.earnWithdraw).mockResolvedValue(`0x${'e2'.repeat(32)}`)
  vi.mocked(T.earnDeposit).mockClear()
  vi.mocked(T.earnWithdraw).mockClear()
})

describe('Confidential payroll and surplus policies', () => {
  it('requires Finance and blocks confidential payroll before calling the payment provider', async () => {
    const { app } = await import('./app.js')
    const finance = await login(app)
    const sam = await login(app, 'sam')
    expect((await post(app, '/api/settings/payroll-privacy', sam, { mode: 'confidential' })).status).toBe(403)
    expect((await post(app, '/api/settings/payroll-privacy', finance, { mode: 'confidential' })).status).toBe(200)
    const preview = await (await app.request('/api/payday/preview', { headers: { cookie: finance } })).json()
    expect(preview.privacy).toMatchObject({ blocked: true, available: false })
    const pay = await post(app, '/api/payday', finance, { requestId: 'private-payday' })
    expect(pay.status).toBe(409)
    expect(tempoCalls.payday).toBe(0)
    expect((await state(app, finance)).paydayRuns).toHaveLength(0)
    expect((await post(app, '/api/settings/payroll-privacy', finance, { mode: 'public' })).status).toBe(400)
    expect((await post(app, '/api/settings/payroll-privacy', finance, { mode: 'public', acknowledgePublic: true })).status).toBe(200)
    expect((await post(app, '/api/payday', finance, { requestId: 'public-payday' })).status).toBe(200)
    expect(tempoCalls.payday).toBe(1)
  })
  it('does not expose batch hashes or other salaries through employee state, receipts or CSV', async () => {
    const { app } = await import('./app.js')
    const finance = await login(app)
    await post(app, '/api/payday', finance, { requestId: 'scoped-payday' })
    const sam = await login(app, 'sam')
    const employee = await state(app, sam)
    expect(employee.paydayRuns[0].lines).toHaveLength(1)
    expect(employee.paydayRuns[0].lines[0].personId).toBe('sam')
    expect(employee.paydayRuns[0].tx).toBeUndefined()
    const pay = employee.activity.find((a: any) => a.kind === 'payday')
    expect(pay.receipt).toBeUndefined()
    const receipt = await (await app.request(`/api/receipts/${pay.id}`, { headers: { cookie: sam } })).json()
    expect(receipt.publicRecord).toBeUndefined()
    const csv = await (await app.request('/api/activity.csv', { headers: { cookie: sam } })).text()
    expect(csv).not.toContain('0x' + '6'.repeat(64))
    const admin = await state(app, finance)
    expect(admin.paydayRuns[0].tx).toBe('0x' + '6'.repeat(64))
    const ava = await login(app, 'ava')
    const lead = await state(app, ava)
    expect(lead.people.find((p: any) => p.id === 'sam').salary).toBeUndefined()
    expect(lead.paydayRuns[0].lines.every((p: any) => p.personId === 'ava')).toBe(true)
  })
  it('blocks deposits without Finance risk approval and respects the cash reserve', async () => {
    const { app } = await import('./app.js')
    const finance = await login(app)
    const ava = await login(app, 'ava')
    expect((await post(app, '/api/earn/design/policy', ava, { enabled: true, cashReserve: 500, acknowledgeRisk: true })).status).toBe(403)
    expect((await post(app, '/api/pots/design/earn', finance, { action: 'deposit', amount: 1 })).status).toBe(400)
    expect((await post(app, '/api/earn/design/policy', finance, { enabled: true, cashReserve: 500, acknowledgeRisk: false })).status).toBe(400)
    await post(app, '/api/earn/design/policy', finance, { enabled: true, cashReserve: 500, acknowledgeRisk: true })
    expect((await post(app, '/api/pots/design/earn', finance, { action: 'deposit', amount: 500 })).status).toBe(400)
    expect((await post(app, '/api/pots/design/earn', ava, { action: 'deposit', amount: 499, requestId: 'deposit-boundary' })).status).toBe(200)
    expect((await post(app, '/api/pots/design/earn', finance, { action: 'deposit', amount: 0.01 })).status).toBe(400)
    const st = await state(app, finance)
    expect(st.earn.byPot.design).toMatchObject({ balance: 499, available: 0, protectedCash: 501 })
    await post(app, '/api/earn/design/policy', finance, { enabled: false, cashReserve: 600, acknowledgeRisk: false })
    expect((await post(app, '/api/pots/design/earn', finance, { action: 'withdraw', amount: 499 })).status).toBe(200)
  })
  it('protects treasury payroll and obligations, rechecks fresh cash, and binds idempotency to its payload', async () => {
    const { app } = await import('./app.js')
    const T = await import('./tempo.js')
    const finance = await login(app)
    vi.mocked(T.balanceOf).mockResolvedValue(100000)
    await post(app, '/api/earn/company/policy', finance, { enabled: true, cashReserve: 1000, acknowledgeRisk: true })
    const before = await state(app, finance)
    expect(before.earn.treasury.payroll).toBeGreaterThan(0)
    expect(before.earn.treasury.protectedCash).toBeGreaterThan(1000)
    const body = { action: 'deposit', amount: 50, requestId: 'treasury-deposit' }
    expect((await post(app, '/api/earn/company/move', finance, body)).status).toBe(200)
    expect((await post(app, '/api/earn/company/move', finance, body)).status).toBe(200)
    expect((await state(app, finance)).earn.treasury.balance).toBe(50)
    expect((await post(app, '/api/earn/company/move', finance, { ...body, amount: 51 })).status).toBe(400)
    vi.mocked(T.balanceOf).mockResolvedValue(0)
    expect((await post(app, '/api/earn/company/move', finance, { action: 'deposit', amount: 1 })).status).toBe(400)
    expect((await post(app, '/api/earn/company/move', finance, { action: 'deposit', amount: 0.001 })).status).toBe(400)
  })
  it('requires durable storage and creates no pending intent when preflight fails', async () => {
    const { app } = await import('./app.js')
    const T = await import('./tempo.js')
    const Store = await import('./store.js')
    const finance = await login(app)
    vi.mocked(T.earnLive).mockReturnValue(true)
    vi.mocked(Store.storeKind).mockReturnValue('memory')
    const req = { action: 'withdraw', amount: 20, requestId: 'preflight-withdraw' }
    expect((await post(app, '/api/pots/design/earn', finance, req)).status).toBe(400)
    expect(T.earnWithdraw).not.toHaveBeenCalled()
    vi.mocked(Store.storeKind).mockReturnValue('redis')
    vi.mocked(T.earnPrepare).mockRejectedValueOnce(new Error('Wrong vault asset'))
    expect((await post(app, '/api/pots/design/earn', finance, req)).status).toBe(500)
    expect(Object.values(mem.state.processed).some((p: any) => p.pending)).toBe(false)
    vi.mocked(T.earnWithdraw).mockImplementationOnce(async () => {
      expect(Object.values(mem.state.processed).some((p: any) => p.pending && p.scope === 'design')).toBe(true)
      return `0x${'e2'.repeat(32)}`
    })
    expect((await post(app, '/api/pots/design/earn', finance, req)).status).toBe(200)
    expect(T.earnWithdraw).toHaveBeenCalledTimes(1)
    expect(Object.values(mem.state.processed).some((p: any) => p.pending)).toBe(false)
  })
  it('does not reinterpret a disconnected real position as simulated zero', async () => {
    const { app } = await import('./app.js')
    const finance = await login(app)
    mem.state.pots.find((p: any) => p.id === 'design').earn = { mode: 'real', balance: 123, updatedAt: 1, vault: '0x0000000000000000000000000000000000000001' }
    const result = await state(app, finance)
    expect(result.earn.byPot.design.balance).toBeNull()
    expect(result.earn.byPot.design.error).toBeTruthy()
  })
  it('rejects an existing ledger when the configured payment asset or network changes', async () => {
    const { app } = await import('./app.js')
    const finance = await login(app)
    mem.state.company.paymentToken = '0x0000000000000000000000000000000000000002'
    expect((await app.request('/api/state', { headers: { cookie: finance } })).status).toBe(409)
    mem.state.company.paymentToken = undefined
    mem.state.company.network = 'mainnet'
    expect((await post(app, '/api/payday', finance, {})).status).toBe(409)
    expect(tempoCalls.payday).toBe(0)
  })
  it('shows unknown data as unavailable and never converts a failed withdrawal into cash', async () => {
    const { app } = await import('./app.js')
    const T = await import('./tempo.js')
    const finance = await login(app)
    vi.mocked(T.earnLive).mockReturnValue(true)
    vi.mocked(T.earnSnapshot).mockRejectedValueOnce(new Error('RPC unavailable'))
    const unavailable = await state(app, finance)
    expect(Object.values(unavailable.earn.byPot).some((p: any) => p.balance === null && p.error)).toBe(true)
    vi.mocked(T.earnWithdraw).mockRejectedValue(new Error('RPC timeout after submission'))
    const req = { action: 'withdraw', amount: 20, requestId: 'ambiguous-withdraw' }
    expect((await post(app, '/api/pots/design/earn', finance, req)).status).toBe(500)
    expect(mem.state.pots.find((p: any) => p.id === 'design').earn).toBeUndefined()
    expect((await post(app, '/api/pots/design/earn', finance, req)).status).toBe(409)
    expect((await post(app, '/api/pots/design/earn', finance, { ...req, requestId: 'new-attempt-id' })).status).toBe(409)
    expect(T.earnWithdraw).toHaveBeenCalledTimes(1)
    expect(mem.state.activity.some((a: any) => a.title === 'Earn withdrawal confirmed')).toBe(false)
  })
})
