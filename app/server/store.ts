// State storage. When Upstash Redis is connected (KV_REST_API_* or UPSTASH_REDIS_REST_* env), Redis is the
// shared source of truth across instances: requests check a version number (at most every 2 s) and fetch the
// full state only when it changed; writes are an atomic compare-and-set. Without Redis: memory is the source of truth inside a server instance; a JSON file (local, or /tmp on
// Vercel) survives restarts of the same instance; Vercel Blob, when enabled and healthy, persists across
// instances. Blob is read only on a cold start and written at most every few seconds, so polling never
// costs storage operations. Any Blob error switches this instance to memory + file automatically.
// State never holds secrets: demo spending keys are derived from the server secret on demand.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { del, list, put } from '@vercel/blob'
import { Redis } from '@upstash/redis'

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
let redis: Redis | null = REDIS_URL && REDIS_TOKEN ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN }) : null
const KEY = 'teampot:state', VKEY = 'teampot:version'
let lastCheck = 0
const disableRedis = (e: unknown) => { redis = null; console.error(JSON.stringify({ level: 'warn', msg: 'redis disabled, using memory + file', err: String((e as any)?.message ?? e).slice(0, 160) })) }
// Atomic compare-and-set: write only if the stored version is still the one this request started from.
const CAS = `local v = tonumber(redis.call('GET', KEYS[2]) or '0')
if ARGV[3] ~= '' and v ~= tonumber(ARGV[3]) then return 0 end
redis.call('SET', KEYS[1], ARGV[1]); redis.call('SET', KEYS[2], ARGV[2]); return 1`
export const storeKind = () => (redis ? 'redis' : process.env.BLOB_READ_WRITE_TOKEN && !blobOff ? 'blob' : 'memory')

const PREFIX = 'teampot/state-'
const filePath = () => process.env.TEAMPOT_STATE_FILE || (process.env.VERCEL ? '/tmp/teampot-state.json' : 'data/state.json')
let blobOff = process.env.TEAMPOT_STORE === 'memory'
const useBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN && !blobOff
const disableBlob = (e: unknown) => { blobOff = true; console.error(JSON.stringify({ level: 'warn', msg: 'blob disabled, using memory + file', err: String((e as any)?.message ?? e).slice(0, 160) })) }

let mem: any = null
let saves = 0
let pending: ReturnType<typeof setTimeout> | null = null

async function readBlob<T>(): Promise<T | null> {
  const { blobs } = await list({ prefix: PREFIX, limit: 1000 })
  const newest = blobs.sort((a, b) => b.pathname.localeCompare(a.pathname))[0]
  if (!newest) return null
  const r = await fetch(newest.url, { cache: 'no-store' })
  return r.ok ? ((await r.json()) as T) : null
}

export async function load<T>(opts: { fresh?: boolean } = {}): Promise<T | null> {
  if (redis) {
    try {
      // Reads may reuse a copy checked in the last 2 s; writes (fresh) always check the shared version first.
      if (!opts.fresh && mem && Date.now() - lastCheck < 2000) return structuredClone(mem)
      const v = Number((await redis.get(VKEY)) ?? 0)
      lastCheck = Date.now()
      if (mem && (mem.version ?? 0) === v) return structuredClone(mem)
      const st = await redis.get<T>(KEY)
      mem = st ?? null
      return st ? structuredClone(st) : null
    } catch (e) { disableRedis(e) }
  }
  if (mem) return structuredClone(mem)
  const FILE = filePath()
  if (useBlob()) {
    try { const s = await readBlob<T>(); if (s) { mem = s; return structuredClone(s) } } catch (e) { disableBlob(e) }
  }
  if (existsSync(FILE)) { mem = JSON.parse(readFileSync(FILE, 'utf8')); return structuredClone(mem) }
  return null
}

async function flushBlob() {
  pending = null
  if (!useBlob() || !mem) return
  try {
    await put(`${PREFIX}${String(Date.now()).padStart(15, '0')}.json`, JSON.stringify(mem), { access: 'public', addRandomSuffix: true, contentType: 'application/json' } as any)
    if (++saves % 20 === 0) {
      const { blobs } = await list({ prefix: PREFIX, limit: 1000 })
      const old = blobs.sort((a, b) => b.pathname.localeCompare(a.pathname)).slice(3).map((b) => b.url)
      if (old.length) await del(old)
    }
  } catch (e) { disableBlob(e) }
}

export async function save(state: any, expectedVersion?: number) {
  if (redis) {
    try {
      const ok = await redis.eval(CAS, [KEY, VKEY], [JSON.stringify(state), String(state.version ?? 0), expectedVersion === undefined ? '' : String(expectedVersion)])
      if (Number(ok) !== 1) {
        mem = null; lastCheck = 0
        const e: any = new Error('State changed while this request was saving. Please retry.')
        e.status = 409
        e.code = 'VERSION_CONFLICT'
        throw e
      }
      mem = structuredClone(state); lastCheck = Date.now()
      return
    } catch (e: any) { if (e?.code === 'VERSION_CONFLICT') throw e; disableRedis(e) }
  }
  if (expectedVersion !== undefined && mem && (mem.version ?? 0) !== expectedVersion) {
    const e: any = new Error('State changed while this request was saving. Please retry.')
    e.status = 409
    e.code = 'VERSION_CONFLICT'
    throw e
  }
  mem = structuredClone(state)
  const FILE = filePath()
  try { mkdirSync(FILE.split('/').slice(0, -1).join('/') || '.', { recursive: true }); writeFileSync(FILE, JSON.stringify(mem)) } catch { /* read-only FS: memory still holds it */ }
  if (useBlob() && !pending) pending = setTimeout(() => { void flushBlob() }, 3000)
}

/** Tests and resets: forget the in-memory copy. */
export function resetMemory() { mem = null }

/**
 * Serialize writes across all server instances. A write holds a short Redis lock while it reads fresh state,
 * talks to Tempo and saves, so two instances can never both act on the same version (no lost payments).
 * Without Redis, one instance is the only writer and the in-process queue already serializes.
 */
const LOCK = 'teampot:write-lock'
const RELEASE = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end`
export async function withWriteLock<T>(fn: () => Promise<T>, { ttlMs = 180_000, waitMs = 60_000 } = {}): Promise<T> {
  if (!redis) return fn()
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const started = Date.now()
  for (;;) {
    let got: unknown
    try { got = await redis.set(LOCK, token, { nx: true, px: ttlMs }) } catch (e) { disableRedis(e); return fn() }
    if (got === 'OK') break
    if (Date.now() - started > waitMs) {
      const e: any = new Error('Teampot is busy finishing another payment. Try again in a moment.')
      e.status = 503
      throw e
    }
    await new Promise((res) => setTimeout(res, 120 + Math.random() * 120))
  }
  try { return await fn() } finally { await redis?.eval(RELEASE, [LOCK], [token]).catch(() => {}) }
}

/* ---- Waitlist: kept apart from the demo state, so demo resets never touch it ---- */
export type WaitlistEntry = { email: string; name?: string; company?: string; role: string; size?: string; note?: string; at: number; source?: string }
const WKEY = 'teampot:waitlist'
const waitFile = () => (process.env.VERCEL ? '/tmp/teampot-waitlist.json' : 'data/waitlist.json')
let waitMem: Record<string, WaitlistEntry> | null = null
function readWaitFile() {
  if (waitMem) return waitMem
  try { waitMem = existsSync(waitFile()) ? JSON.parse(readFileSync(waitFile(), 'utf8')) : {} } catch { waitMem = {} }
  return waitMem!
}
/** Adds an entry; returns false when the email was already on the list. */
export async function waitlistAdd(e: WaitlistEntry): Promise<boolean> {
  if (redis) {
    try { return Number(await redis.hsetnx(WKEY, e.email, JSON.stringify(e))) === 1 } catch (err) { disableRedis(err) }
  }
  const all = readWaitFile()
  if (all[e.email]) return false
  all[e.email] = e
  try { mkdirSync(waitFile().split('/').slice(0, -1).join('/') || '.', { recursive: true }); writeFileSync(waitFile(), JSON.stringify(all)) } catch { /* memory still holds it */ }
  return true
}
export async function waitlistAll(): Promise<WaitlistEntry[]> {
  if (redis) {
    try {
      const h = (await redis.hgetall<Record<string, unknown>>(WKEY)) ?? {}
      return Object.values(h).map((v) => (typeof v === 'string' ? JSON.parse(v) : v) as WaitlistEntry).sort((a, b) => a.at - b.at)
    } catch (err) { disableRedis(err) }
  }
  return Object.values(readWaitFile()).sort((a, b) => a.at - b.at)
}

/* ============================== Site stats ============================== */
// First-party, cookie-free page-view counts: views per day, unique visitors per day (HyperLogLog over a salted
// daily hash, so no visitor can be tracked across days), top pages and referrers. Kept 90 days.
const SK = 'teampot:stats'
const statMem = { views: {} as Record<string, number>, uv: {} as Record<string, Set<string>>, paths: {} as Record<string, number>, refs: {} as Record<string, number> }
const TTL = 90 * 86400
export async function statsHit(day: string, visitor: string, path: string, ref: string) {
  if (redis) {
    try {
      const p = redis.pipeline()
      p.incr(`${SK}:views:${day}`); p.expire(`${SK}:views:${day}`, TTL)
      p.pfadd(`${SK}:uv:${day}`, visitor); p.expire(`${SK}:uv:${day}`, TTL)
      p.hincrby(`${SK}:paths`, path, 1)
      if (ref) p.hincrby(`${SK}:refs`, ref, 1)
      await p.exec()
      return
    } catch (err) { disableRedis(err) }
  }
  statMem.views[day] = (statMem.views[day] ?? 0) + 1
  ;(statMem.uv[day] ??= new Set()).add(visitor)
  statMem.paths[path] = (statMem.paths[path] ?? 0) + 1
  if (ref) statMem.refs[ref] = (statMem.refs[ref] ?? 0) + 1
}
export async function statsRead(days: string[]) {
  const top = (h: Record<string, unknown> | null) => Object.entries(h ?? {}).map(([k, v]) => [k, Number(v)] as const).sort((a, b) => b[1] - a[1]).slice(0, 12)
  if (redis) {
    try {
      const p = redis.pipeline()
      for (const d of days) { p.get(`${SK}:views:${d}`); p.pfcount(`${SK}:uv:${d}`) }
      p.hgetall(`${SK}:paths`); p.hgetall(`${SK}:refs`)
      const r = (await p.exec()) as unknown[]
      const daily = days.map((d, i) => ({ day: d, views: Number(r[i * 2] ?? 0), visitors: Number(r[i * 2 + 1] ?? 0) }))
      return { daily, paths: top(r[days.length * 2] as any), referrers: top(r[days.length * 2 + 1] as any) }
    } catch (err) { disableRedis(err) }
  }
  return { daily: days.map((d) => ({ day: d, views: statMem.views[d] ?? 0, visitors: statMem.uv[d]?.size ?? 0 })), paths: top(statMem.paths), referrers: top(statMem.refs) }
}
