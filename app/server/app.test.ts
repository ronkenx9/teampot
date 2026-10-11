import { beforeEach, describe, expect, it, vi } from 'vitest'

const mem: { state: any } = { state: null }
const tempoCalls = { payday: 0 }

vi.mock('./store.js', () => ({
  load: vi.fn(async () => mem.state),
  save: vi.fn(async (s: any) => { mem.state = JSON.parse(JSON.stringify(s)) }),
}))

vi.mock('./tempo.js', () => ({
  TOKEN: '0x20c0000000000000000000000000000000000000',
  EXPLORER: 'https://records.example/',
  EXPLORER_ACCOUNT: 'https://records.example/account/',
  NETWORK: 'testnet',
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

describe('API validation and guards', () => {
  beforeEach(() => {
    mem.state = null
    tempoCalls.payday = 0
  })

  const demoCookie = async (app: any, personId = 'jordan') => {
    const r = await app.request('/api/auth/demo', { method: 'POST', body: JSON.stringify({ personId }), headers: { 'content-type': 'application/json' } })
    return r.headers.get('set-cookie')!.split(';')[0]
  }

  it('returns friendly 400s for bad input', async () => {
    const { app } = await import('./app.js')
    const cookie = await demoCookie(app)
    const r = await app.request('/api/vendors', { method: 'POST', body: JSON.stringify({ name: '', category: '' }), headers: { 'content-type': 'application/json', cookie } })
    expect(r.status).toBe(400)
    expect((await r.json()).error).toBeTruthy()
  })

  it('returns 404 for unknown ids', async () => {
    const { app } = await import('./app.js')
    const cookie = await demoCookie(app)
    const r = await app.request('/api/people/not-here/update', { method: 'POST', body: JSON.stringify({ title: 'x' }), headers: { 'content-type': 'application/json', cookie } })
    expect(r.status).toBe(404)
    expect((await r.json()).error).toMatch(/not found/i)
  })

  it('guards payday with request idempotency', async () => {
    const { app } = await import('./app.js')
    const cookie = await demoCookie(app)
    const body = JSON.stringify({ requestId: 'payday-same-key' })
    const a = await app.request('/api/payday', { method: 'POST', body, headers: { 'content-type': 'application/json', cookie } })
    const b = await app.request('/api/payday', { method: 'POST', body, headers: { 'content-type': 'application/json', cookie } })
    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    expect((await a.json()).tx).toEqual((await b.json()).tx)
    expect(tempoCalls.payday).toBe(1)
  })

  it("scopes an employee state view to that person's money only", async () => {
    const { app } = await import('./app.js')
    const finance = await demoCookie(app)
    await app.request('/api/payday', { method: 'POST', body: JSON.stringify({ requestId: 'privacy-payday' }), headers: { 'content-type': 'application/json', cookie: finance } })

    const sam = await demoCookie(app, 'sam')
    const r = await app.request('/api/state', { headers: { cookie: sam } })
    expect(r.status).toBe(200)
    const body = await r.json()
    const dump = JSON.stringify(body)

    expect(body.people.map((p: any) => p.id)).toEqual(['sam'])
    expect(body.paydayRuns).toHaveLength(1)
    expect(body.paydayRuns[0].total).toBe(3600)
    expect(body.paydayRuns[0].count).toBe(1)
    expect(body.paydayRuns[0].lines).toEqual([{ personId: 'sam', gross: 3600, memo: body.paydayRuns[0].lines[0].memo }])
    expect(body.activity.find((a: any) => a.kind === 'payday')?.amount).toBe(3600)
    expect(dump).not.toContain('16500')
    // Sam sees who runs Design (the head who signed the card) but no one else's money.
    expect(body.controls.departments).toHaveLength(1)
    expect(body.controls.departments[0].cards.every((c: any) => c.personId === 'sam')).toBe(true)
    expect(body.controls.treasury.balance).toBeNull()
    expect(dump).not.toContain('Priya Nair')
    expect(dump).not.toContain('Leo Martin')
    expect(dump).not.toContain('4800')
    expect(dump).not.toContain('3900')
  })

  it('declines invoices with a reason', async () => {
    const { app } = await import('./app.js')
    const mateo = await demoCookie(app, 'mateo')
    const created = await app.request('/api/invoices', { method: 'POST', body: JSON.stringify({ contractorId: 'mateo', amount: 50, description: 'Sketches' }), headers: { 'content-type': 'application/json', cookie: mateo } })
    const inv = await created.json()
    const finance = await demoCookie(app)
    const declined = await app.request(`/api/invoices/${inv.id}/decline`, { method: 'POST', body: JSON.stringify({ reason: 'Wrong file type' }), headers: { 'content-type': 'application/json', cookie: finance } })
    expect(declined.status).toBe(200)
    const body = await declined.json()
    expect(body.status).toBe('declined')
    expect(body.declineReason).toBe('Wrong file type')
  })

  it('authorizes API calls from the session role, not request body viewer fields', async () => {
    const { app } = await import('./app.js')
    const ava = await demoCookie(app, 'ava')
    const bad = await app.request('/api/pots/eng/return', { method: 'POST', body: JSON.stringify({ amount: 1, requestId: 'auth-eng-return' }), headers: { 'content-type': 'application/json', cookie: ava } })
    expect(bad.status).toBe(403)

    const sam = await demoCookie(app, 'sam')
    const spendAsAva = await app.request('/api/spend', { method: 'POST', body: JSON.stringify({ personId: 'ava', vendorId: 'figma', amount: 5, note: 'x' }), headers: { 'content-type': 'application/json', cookie: sam } })
    expect(spendAsAva.status).toBe(403)
  })

  it('turns payments over the Finance threshold into Finance-only decisions', async () => {
    const { app } = await import('./app.js')
    const sam = await demoCookie(app, 'sam')
    const held = await app.request('/api/spend', { method: 'POST', body: JSON.stringify({ personId: 'sam', vendorId: 'figma', amount: 1200, note: 'Annual suite', requestId: 'finance-rule-test' }), headers: { 'content-type': 'application/json', cookie: sam } })
    expect(held.status).toBe(200)
    const body = await held.json()
    expect(body.held.reason).toBe('finance-rule')

    const ava = await demoCookie(app, 'ava')
    const leadApprove = await app.request(`/api/held/${body.held.id}/approve`, { method: 'POST', body: JSON.stringify({ requestId: 'lead-finance-rule-test' }), headers: { 'content-type': 'application/json', cookie: ava } })
    expect(leadApprove.status).toBe(403)

    const finance = await demoCookie(app, 'jordan')
    const financeReturn = await app.request(`/api/held/${body.held.id}/return`, { method: 'POST', body: JSON.stringify({ requestId: 'finance-rule-return-test' }), headers: { 'content-type': 'application/json', cookie: finance } })
    expect(financeReturn.status).toBe(200)
    expect((await financeReturn.json()).status).toBe('returned')
  })

  const post = (app: any, path: string, cookie: string, body: unknown = {}) =>
    app.request(path, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', cookie } })

  it('keeps the frame with Finance: heads cannot change budgets, salaries, roles or appoint heads', async () => {
    const { app } = await import('./app.js')
    const finance = await demoCookie(app)
    await post(app, '/api/setup', finance)
    const ava = await demoCookie(app, 'ava')
    expect((await post(app, '/api/pots/design/update', ava, { budget: 99999 })).status).toBe(403)
    expect((await post(app, '/api/pots/design/update', ava, { perPersonCap: 99999 })).status).toBe(400)
    expect((await post(app, '/api/people/sam/update', ava, { salary: 9000 })).status).toBe(403)
    expect((await post(app, '/api/people/sam/update', ava, { role: 'lead' })).status).toBe(403)
    expect((await post(app, '/api/people', ava, { name: 'Zed Lin', role: 'lead', title: 'Co-lead', team: 'design' })).status).toBe(403)
    expect((await post(app, '/api/people', ava, { name: 'Zed Lin', role: 'employee', title: 'Designer', team: 'design', salary: 5000 })).status).toBe(403)
    expect((await post(app, '/api/pots/design/head', ava, { personId: 'sam' })).status).toBe(403)
    const ok = await post(app, '/api/pots/design/update', ava, { perPersonCap: 700 })
    expect(ok.status).toBe(200)
  })

  it('appoints heads with an admin key and signs member cards with it', async () => {
    const T: any = await import('./tempo.js')
    const { app } = await import('./app.js')
    const finance = await demoCookie(app)
    await post(app, '/api/setup', finance)
    expect(T.authorizeAdminKey).toHaveBeenCalled()
    const state = await (await app.request('/api/state', { headers: { cookie: finance } })).json()
    const design = state.controls.departments.find((d: any) => d.id === 'design')
    expect(design.head.personId).toBe('ava')
    expect(design.head.tx).toMatch(/^0x/)
    expect(design.cards.find((c: any) => c.personId === 'sam').issuedBy).toBe('Ava Chen')
    expect(design.cards.find((c: any) => c.personId === 'ava').issuedBy).toBe('Finance')
  })

  it('routes a head approval through the head key and a Finance approval through the department root', async () => {
    const T: any = await import('./tempo.js')
    const { app } = await import('./app.js')
    const finance = await demoCookie(app)
    await post(app, '/api/setup', finance)
    T.spendWithKeyOn.mockRejectedValueOnce(new Error('not on list'))
    const sam = await demoCookie(app, 'sam')
    const held = (await (await post(app, '/api/spend', sam, { personId: 'sam', vendorId: 'pixelvault-stock', amount: 45, note: 'x' })).json()).held
    T.spendWithKeyOn.mockClear()
    const ava = await demoCookie(app, 'ava')
    const decided = await (await post(app, `/api/held/${held.id}/approve`, ava, {})).json()
    expect(decided.signedBy).toMatch(/Ava's head key/)
    expect(T.spendWithKeyOn).toHaveBeenCalledTimes(1)
  })

  it('turns a top-up request into a real Finance funding decision', async () => {
    const T: any = await import('./tempo.js')
    const { app } = await import('./app.js')
    const finance = await demoCookie(app)
    await post(app, '/api/setup', finance)
    const ava = await demoCookie(app, 'ava')
    const req = await (await post(app, '/api/pots/design/topup-request', ava, { amount: 500, note: 'Offsite' })).json()
    expect(req.status).toBe('requested')
    expect((await post(app, `/api/topups/${req.id}/fund`, ava)).status).toBe(403)
    T.companyPay.mockClear()
    const funded = await (await post(app, `/api/topups/${req.id}/fund`, finance)).json()
    expect(funded.status).toBe('funded')
    expect(T.companyPay).toHaveBeenCalledTimes(1)
  })

  it('pays only people on payroll: removed people are left out', async () => {
    const T: any = await import('./tempo.js')
    const { app } = await import('./app.js')
    const finance = await demoCookie(app)
    await post(app, '/api/setup', finance)
    expect((await post(app, '/api/people/leo/remove', finance)).status).toBe(200)
    T.payday.mockClear()
    await post(app, '/api/payday', finance, { requestId: 'payroll-removed' })
    const lines = T.payday.mock.calls[0][0] as { amount: number }[]
    expect(lines.map((l) => l.amount)).not.toContain(3900)
    const preview = await (await app.request('/api/payday/preview', { headers: { cookie: finance } })).json()
    expect(preview.lines.map((l: any) => l.personId)).not.toContain('leo')
  })

  it("pays invited people into their own account, not a throwaway address", async () => {
    const T: any = await import('./tempo.js')
    const { app } = await import('./app.js')
    const finance = await demoCookie(app)
    await post(app, '/api/setup', finance)
    const inv = await (await post(app, '/api/invites', finance, { name: 'Nora Patel', role: 'employee', title: 'Designer', team: 'design', salary: 3000 })).json()
    expect(inv.person.address).toBe(T.derivedPersonalAddress('x', 'nora-patel'))
  })

  it('refuses to sell more shares than you hold, with a clear message', async () => {
    const { app } = await import('./app.js')
    const finance = await demoCookie(app)
    await post(app, '/api/setup', finance)
    const sam = await demoCookie(app, 'sam')
    const r = await post(app, '/api/invest/trade', sam, { personId: 'sam', stockId: 'aapl', side: 'sell', shares: 5 })
    expect(r.status).toBe(400)
    expect((await r.json()).error).toMatch(/shares to sell/)
  })

  it('gives an agent its own card: pays on-card vendors, sends the rest to the head', async () => {
    const { app } = await import('./app.js')
    const finance = await demoCookie(app)
    await post(app, '/api/setup', finance)
    const sam = await demoCookie(app, 'sam')
    expect((await post(app, '/api/agents', sam, { name: 'Sam Bot', team: 'design', purpose: 'x', cap: 50, vendorIds: ['figma'] })).status).toBe(403)
    const ava = await demoCookie(app, 'ava')
    const made = await (await post(app, '/api/agents', ava, { name: 'Design Bot', team: 'design', purpose: 'Buys fonts', cap: 200, vendorIds: ['adobe-fonts'] })).json()
    expect(made.token).toMatch(/^tpa_/)
    const pay = (body: unknown, token = made.token) => app.request('/api/agent/pay', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` } })
    const ok = await (await pay({ vendorId: 'adobe-fonts', amount: 12 })).json()
    expect(ok.ok).toBe(true)
    const off = await (await pay({ vendorId: 'aws', amount: 12 })).json()
    expect(off.ok).toBe(false)
    expect(off.held.reason).toBe('new-vendor')
    expect((await pay({ vendorId: 'aws', amount: 1 }, 'tpa_wrong')).status).toBe(401)
  })

  it('sends your own money by username or to a saved payee', async () => {
    const { app } = await import('./app.js')
    const finance = await demoCookie(app)
    await post(app, '/api/setup', finance)
    const sam = await demoCookie(app, 'sam')
    const look = await (await app.request('/api/lookup/@ava', { headers: { cookie: sam } })).json()
    expect(look.name).toBe('Ava Chen')
    expect((await app.request('/api/lookup/nobody', { headers: { cookie: sam } })).status).toBe(404)
    const sent = await (await post(app, '/api/transfer', sam, { handle: '@ava', amount: 5, note: 'Lunch' })).json()
    expect(sent.ok).toBe(true)
    expect((await post(app, '/api/transfer', sam, { account: '0x123', name: 'Bad', amount: 5 })).status).toBe(400)
    const acct = `0x${'ab'.repeat(20)}`
    expect((await (await post(app, '/api/transfer', sam, { account: acct, name: 'Lena Studio', save: true, amount: 5 })).json()).ok).toBe(true)
    const state = await (await app.request('/api/state', { headers: { cookie: sam } })).json()
    expect(state.beneficiaries.map((b: any) => b.name)).toContain('Lena Studio')
  })

  it('puts idle department budget to work and brings it back (simulated without a vault)', async () => {
    const { app } = await import('./app.js')
    const finance = await demoCookie(app)
    await post(app, '/api/setup', finance)
    const put = await (await post(app, '/api/pots/design/earn', finance, { action: 'deposit', amount: 100 })).json()
    expect(put).toMatchObject({ ok: true, mode: 'simulated', balance: 100 })
    expect((await post(app, '/api/pots/design/earn', finance, { action: 'withdraw', amount: 150 })).status).toBe(400)
    expect((await (await post(app, '/api/pots/design/earn', finance, { action: 'withdraw', amount: 40 })).json()).balance).toBe(60)
    const sam = await demoCookie(app, 'sam')
    expect((await post(app, '/api/pots/design/earn', sam, { action: 'deposit', amount: 10 })).status).toBe(403)
  })

  it('runs a Visa card through the same Tempo card rules', async () => {
    const { app } = await import('./app.js')
    const finance = await demoCookie(app)
    await post(app, '/api/setup', finance)
    const sam = await demoCookie(app, 'sam')
    const card = await (await post(app, '/api/cards/visa', sam, { personId: 'sam' })).json()
    expect(card.mode).toBe('simulated')
    expect(card.last4).toMatch(/^\d{4}$/)
    const ok = await (await post(app, '/api/issuing/simulate', sam, { personId: 'sam', merchant: 'Figma', mcc: '5734', amount: 24 })).json()
    expect(ok.approved).toBe(true)
    const no = await (await post(app, '/api/issuing/simulate', sam, { personId: 'sam', merchant: 'Apple Store', mcc: '5732', amount: 24 })).json()
    expect(no.approved).toBe(false)
    expect(no.reason).toBe('category')
    expect(no.held.channel).toBe('visa')
    expect((await app.request('/api/issuing/webhook', { method: 'POST', body: '{}' })).status).toBe(503)
  })
})

describe('card issuer webhook signatures', () => {
  it('accepts a valid Stripe signature and rejects tampering or stale ones', async () => {
    const { createHmac } = await import('node:crypto')
    const { verifyStripeSignature } = await import('./issuing.js')
    const raw = '{"type":"issuing_authorization.request"}'
    const t = 1_800_000_000
    const sig = createHmac('sha256', 'whsec_test').update(`${t}.${raw}`).digest('hex')
    expect(verifyStripeSignature(raw, `t=${t},v1=${sig}`, 'whsec_test', 300, t + 10)).toBe(true)
    expect(verifyStripeSignature(raw + ' ', `t=${t},v1=${sig}`, 'whsec_test', 300, t + 10)).toBe(false)
    expect(verifyStripeSignature(raw, `t=${t},v1=${sig}`, 'whsec_test', 300, t + 1000)).toBe(false)
  })
})
