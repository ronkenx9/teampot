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

export async function load<T>(): Promise<T | null> {
  if (redis) {
    try {
      if (mem && Date.now() - lastCheck < 2000) return structuredClone(mem)
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
