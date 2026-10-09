import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

let dir = ''

afterEach(() => {
  delete process.env.TEAMPOT_STATE_FILE
  vi.resetModules()
  if (dir) rmSync(dir, { recursive: true, force: true })
  dir = ''
})

describe('optimistic state saves', () => {
  it('rejects a stale save instead of overwriting a newer version', async () => {
    dir = mkdtempSync(join(tmpdir(), 'teampot-store-'))
    process.env.TEAMPOT_STATE_FILE = join(dir, 'state.json')
    const Store = await import('./store.js')

    await Store.save({ version: 0, value: 'first' }, 0)
    const a: any = await Store.load()
    const b: any = await Store.load()

    await Store.save({ ...a, version: 1, value: 'newer' }, a.version)
    await expect(Store.save({ ...b, version: 1, value: 'stale' }, b.version)).rejects.toMatchObject({ status: 409, code: 'VERSION_CONFLICT' })
    await expect(Store.load()).resolves.toMatchObject({ version: 1, value: 'newer' })
  })
})
