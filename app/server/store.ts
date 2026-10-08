// State storage: Vercel Blob when deployed (BLOB_READ_WRITE_TOKEN set), a local JSON file otherwise.
// State never holds secrets: demo spending keys are derived from the server secret on demand.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { list, put } from '@vercel/blob'

const FILE = 'data/state.json'
const BLOB_PATH = 'teampot/state.json'
const useBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN

export async function load<T>(): Promise<T | null> {
  if (!useBlob()) return existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : null
  const { blobs } = await list({ prefix: BLOB_PATH, limit: 1 })
  if (!blobs[0]) return null
  const r = await fetch(`${blobs[0].url}?v=${Date.now()}`, { cache: 'no-store' })
  return r.ok ? ((await r.json()) as T) : null
}

export async function save(state: unknown) {
  const body = JSON.stringify(state)
  if (!useBlob()) { mkdirSync('data', { recursive: true }); writeFileSync(FILE, body); return }
  await put(BLOB_PATH, body, { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 0 } as any)
}
