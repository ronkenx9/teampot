// State storage: Vercel Blob when deployed (BLOB_READ_WRITE_TOKEN set), a local JSON file otherwise.
// State never holds secrets: demo spending keys are derived from the server secret on demand.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { del, list, put } from '@vercel/blob'

const filePath = () => process.env.TEAMPOT_STATE_FILE || 'data/state.json'
// Each save writes a new immutable file (no stale CDN reads); load picks the newest.
const PREFIX = 'teampot/state-'
const useBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN

async function readLatest<T>(): Promise<T | null> {
  const FILE = filePath()
  if (!useBlob()) return existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : null
  const { blobs } = await list({ prefix: PREFIX, limit: 1000 })
  const newest = blobs.sort((a, b) => b.pathname.localeCompare(a.pathname))[0]
  if (!newest) return null
  const r = await fetch(newest.url, { cache: 'no-store' })
  return r.ok ? ((await r.json()) as T) : null
}

export const load = readLatest

export async function save(state: any, expectedVersion?: number) {
  if (expectedVersion !== undefined) {
    const current: any = await readLatest()
    const actual = current?.version ?? 0
    if (actual !== expectedVersion) {
      const e: any = new Error('State changed while this request was saving. Please retry.')
      e.status = 409
      e.code = 'VERSION_CONFLICT'
      throw e
    }
  }
  const body = JSON.stringify(state)
  const FILE = filePath()
  if (!useBlob()) { mkdirSync(FILE.split('/').slice(0, -1).join('/') || '.', { recursive: true }); writeFileSync(FILE, body); return }
  const stamp = String(Date.now()).padStart(15, '0')
  await put(`${PREFIX}${stamp}.json`, body, { access: 'public', addRandomSuffix: true, contentType: 'application/json' } as any)
  const { blobs } = await list({ prefix: PREFIX, limit: 1000 })
  const old = blobs.sort((a, b) => b.pathname.localeCompare(a.pathname)).slice(5).map((b) => b.url)
  if (old.length) await del(old).catch(() => {})
}
