import { beforeEach, describe, expect, it } from 'vitest'
import { createHash, randomUUID } from 'node:crypto'
import { createWorkspaceApp } from './workspaces.js'
import { emptyDirectory, type Directory, type DirectoryStore } from './workspace-store.js'

const hash = (s: string) => createHash('sha256').update(s).digest('hex')
let data: Directory, app: ReturnType<typeof createWorkspaceApp>, memberId: string
const request = (path: string, body?: unknown, headers: Record<string, string> = {}) => app.request('https://test.example' + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) })
const browser = { cookie: 'tp_account=browser-secret', origin: 'https://test.example' }
beforeEach(() => {
 data = emptyDirectory(); memberId = randomUUID()
 data.users.push({ id: 'owner', name: 'Actual owner', createdAt: 0, credentials: [] })
 data.workspaces.push({ id: randomUUID(), name: 'Company A', createdBy: 'owner', createdAt: 0 })
 data.memberships.push({ id: memberId, userId: 'owner', workspaceId: data.workspaces[0].id, role: 'owner', active: true, title: 'Founder' })
 data.sessions.push({ hash: hash('browser-secret'), userId: 'owner', membershipId: memberId, expiresAt: Date.now() + 100000 })
 let queue = Promise.resolve()
 const store: DirectoryStore = { read: async () => structuredClone(data), change: fn => { const next = queue.then(async () => { const draft = structuredClone(data); const result = await fn(draft); data = draft; return result }); queue = next.then(() => {}, () => {}); return next } }
 app = createWorkspaceApp(store)
})
const start = async () => { const r = await request('/mobile/start', {}); expect(r.status).toBe(200); return r.json() }
const approve = (p: any, headers: Record<string, string> = browser) => request('/mobile/approve', { deviceId: p.deviceId, userCode: p.userCode }, headers)
const poll = (p: any) => request('/mobile/poll', { deviceId: p.deviceId, pollingSecret: p.pollingSecret })
describe('real account phone pairing', () => {
 it('keeps phone secret and bearer token out of the browser URL and preview', async () => {
  const p = await start(); expect(p.verificationUrl).not.toContain(p.pollingSecret)
  expect((await poll(p)).status).toBe(200); expect(await (await poll(p)).json()).toEqual({ status: 'pending' })
  expect((await request(`/mobile/preview?deviceId=${p.deviceId}&code=${p.userCode}`)).status).toBe(401)
  const view = await (await request(`/mobile/preview?deviceId=${p.deviceId}&code=${p.userCode}`, undefined, browser)).json()
  expect(view.userCode).toBe(p.userCode); expect(JSON.stringify(view)).not.toContain('secret')
 })
 it('requires same-origin browser confirmation and the phone secret', async () => {
  const p = await start()
  expect((await approve(p, { ...browser, origin: 'https://evil.example' })).status).toBe(403)
  expect((await approve({ ...p, userCode: 'AAAA-BBBB' })).status).toBe(404)
  expect((await approve(p)).status).toBe(200)
  expect((await poll({ ...p, pollingSecret: 'x'.repeat(43) })).status).toBe(404)
  const result = await (await poll(p)).json(); expect(result.token).toMatch(/^tpm_/)
  expect(JSON.stringify(data)).not.toContain(result.token)
  const session = await (await request('/session', undefined, { authorization: 'Bearer ' + result.token })).json()
  expect(session.user.name).toBe('Actual owner'); expect(session.activeMembershipId).toBe(memberId)
  expect((await request('/workspace', undefined, { authorization: 'Bearer ' + result.token })).status).toBe(200)
 })
 it('redelivers the same token after a lost response but never recreates a logged-out session', async () => {
  const p = await start(); await approve(p)
  const first = await (await poll(p)).json(), second = await (await poll(p)).json(); expect(second.token).toBe(first.token)
  expect(data.sessions.filter(s => s.kind === 'mobile')).toHaveLength(1)
  expect((await request('/logout', {}, { authorization: 'Bearer ' + first.token })).status).toBe(200)
  expect((await poll(p)).status).toBe(401)
  expect((await request('/workspace', undefined, { authorization: 'Bearer ' + first.token })).status).toBe(401)
  expect((await request('/workspace', undefined, browser)).status).toBe(200)
 })
 it('cannot use a forged bearer to bypass cookie origin checks or approve another phone', async () => {
  const bad = { ...browser, origin: 'https://evil.example', authorization: 'Bearer tpm_' + 'a'.repeat(43) }
  expect((await request('/workspaces', { name: 'Attack' }, bad)).status).toBe(401)
  expect(data.workspaces).toHaveLength(1)
  const p = await start(); await approve(p); const { token } = await (await poll(p)).json()
  const other = await start(); expect((await approve(other, { ...browser, authorization: 'Bearer ' + token })).status).toBe(403)
 })
 it('enforces expiry and live membership revocation on the phone', async () => {
  const p = await start(); await approve(p); const { token } = await (await poll(p)).json()
  data.memberships[0].active = false
  expect((await request('/workspace', undefined, { authorization: 'Bearer ' + token })).status).toBe(403)
  expect((await (await request('/session', undefined, { authorization: 'Bearer ' + token })).json()).activeMembershipId).toBeNull()
  const q = await start(); data.mobilePairings!.find(x => x.id === q.deviceId)!.expiresAt = 0
  expect((await approve(q)).status).toBe(404); expect((await poll(q)).status).toBe(404)
 })
})
