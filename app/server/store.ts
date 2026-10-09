// State storage. Memory is the source of truth inside a server instance; a JSON file (local, or /tmp on
// Vercel) survives restarts of the same instance; Vercel Blob, when enabled and healthy, persists across
// instances. Blob is read only on a cold start and written at most every few seconds, so polling never
// costs storage operations. Any Blob error switches this instance to memory + file automatically.
// State never holds secrets: demo spending keys are derived from the server secret on demand.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { del, list, put } from '@vercel/blob'

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
