import type { Hono } from 'hono'
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import type { DirectoryStore, Directory } from './workspace-store.js'

const digest = (value: string) => createHash('sha256').update(value).digest('hex')
const failure = (status: number, message: string): never => { throw Object.assign(new Error(message), { status }) }
const pairBody = z.object({ deviceId: z.string().uuid(), pollingSecret: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict()
const throttle = (s: Directory, key: string, max: number) => {
 const now = Date.now(), bucket = s.limits[key]
 if (bucket && bucket.until > now) { if (bucket.count >= max) failure(429, 'Too many connection attempts. Please try again later.'); bucket.count++ }
 else s.limits[key] = { count: 1, until: now + 600000 }
}
export function registerMobilePairing(app: Hono, store: DirectoryStore, actor: (s: Directory, c: any) => { user: Directory['users'][number]; session: Directory['sessions'][number] }) {
 app.post('/mobile/start', async c => {
  const deviceId = randomUUID(), pollingSecret = randomBytes(32).toString('base64url')
  const code = randomBytes(4).toString('hex').toUpperCase(), userCode = `${code.slice(0, 4)}-${code.slice(4)}`, expiresAt = Date.now() + 600000
  await store.change(s => {
   throttle(s, 'mobile-start:' + digest(c.req.header('x-forwarded-for') || 'local'), 15)
   s.mobilePairings = (s.mobilePairings || []).filter(p => p.expiresAt > Date.now())
   if (s.mobilePairings.length > 1000) failure(429, 'Please try connecting again later.')
   s.mobilePairings.push({ id: deviceId, secretHash: digest(pollingSecret), userCode, expiresAt })
  })
  const verificationUrl = `${new URL(c.req.url).origin}/app?device=${deviceId}&code=${userCode}`
  return c.json({ deviceId, pollingSecret, userCode, verificationUrl, expiresAt })
 })
 app.get('/mobile/preview', async c => {
  if (c.req.header('authorization')) failure(403, 'Approve this connection in your browser.')
  const s = await store.read(); actor(s, c)
  const p = s.mobilePairings?.find(p => p.id === c.req.query('deviceId') && p.userCode === c.req.query('code') && p.expiresAt > Date.now())
  if (!p) failure(404, 'This connection expired. Start again on your phone.')
  return c.json({ userCode: p!.userCode, expiresAt: p!.expiresAt, approved: !!p!.userId })
 })
 app.post('/mobile/approve', async c => {
  if (c.req.header('authorization')) failure(403, 'Approve this connection in your browser.')
  const body = z.object({ deviceId: z.string().uuid(), userCode: z.string().regex(/^[A-F0-9]{4}-[A-F0-9]{4}$/) }).strict().parse(await c.req.json())
  await store.change(s => {
   const a = actor(s, c); throttle(s, 'mobile-approve:' + a.user.id, 30)
   const p = s.mobilePairings?.find(p => p.id === body.deviceId && p.userCode === body.userCode && p.expiresAt > Date.now())
   if (!p) failure(404, 'This connection expired. Start again on your phone.')
   if (p!.userId && p!.userId !== a.user.id) failure(409, 'This connection is already approved by another account.')
   p!.userId = a.user.id; p!.membershipId = a.session.membershipId
  })
  return c.json({ ok: true })
 })
 app.post('/mobile/poll', async c => {
  const body = pairBody.parse(await c.req.json())
  const result = await store.change(s => {
   throttle(s, 'mobile-poll:' + digest(c.req.header('x-forwarded-for') || 'local'), 600)
   const p = s.mobilePairings?.find(p => p.id === body.deviceId && p.expiresAt > Date.now())
   if (!p || !timingSafeEqual(Buffer.from(p.secretHash, 'hex'), Buffer.from(digest(body.pollingSecret), 'hex'))) failure(404, 'This connection expired or does not match this phone.')
   if (!p!.userId) return { status: 'pending' as const }
   // Stable delivery allows recovery when the approval response was lost. Only the
   // phone's 256-bit secret can obtain this token, and the directory stores hashes.
   const token = 'tpm_' + createHmac('sha256', body.pollingSecret).update(`teampot-mobile:${p!.id}`).digest('base64url')
   const tokenHash = digest(token)
   if (!p!.tokenHash) {
    p!.tokenHash = tokenHash; p!.sessionExpiresAt = Date.now() + 7 * 86400000
    s.sessions.push({ hash: tokenHash, userId: p!.userId!, membershipId: p!.membershipId, expiresAt: p!.sessionExpiresAt, kind: 'mobile' })
   } else if (!s.sessions.some(v => v.hash === tokenHash && v.expiresAt > Date.now())) failure(401, 'This connection was signed out. Start again on your phone.')
   return { status: 'approved' as const, token, expiresAt: p!.sessionExpiresAt }
  })
  return c.json(result)
 })
}
