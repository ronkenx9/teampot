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
  companyAccount: { address: '0x0000000000000000000000000000000000000001' },
  newAddress: vi.fn(() => `0x${Math.random().toString(16).slice(2).padEnd(40, '0').slice(0, 40)}`),
  derivedKeyPk: vi.fn(() => `0x${'1'.repeat(64)}`),
  derivedDepartmentRootPk: vi.fn(() => `0x${'7'.repeat(64)}`),
  p256RootAddress: vi.fn(() => `0x${'8'.repeat(40)}`),
  rootFromPk: vi.fn(() => ({ address: `0x${'8'.repeat(40)}` })),
  issueKey: vi.fn(async () => `0x${'2'.repeat(64)}`),
  issueKeyOn: vi.fn(async () => `0x${'2'.repeat(64)}`),
  revokeKey: vi.fn(async () => `0x${'3'.repeat(64)}`),
  revokeKeyOn: vi.fn(async () => `0x${'3'.repeat(64)}`),
  remaining: vi.fn(async () => ({ remaining: 100, periodEnd: 1800000000 })),
  remainingOn: vi.fn(async () => ({ remaining: 100, periodEnd: 1800000000 })),
  balanceOf: vi.fn(async () => 1000),
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
    expect(dump).not.toContain('Ava Chen')
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
})
