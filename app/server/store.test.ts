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

describe('mainnet shared storage', () => {
  it('uses isolated keys and refuses fallback after Redis fails', async () => {
    vi.stubEnv('TEMPO_PAYMENT_TOKEN', '0x20c0000000000000000000006a37da5c996874be')
    vi.stubEnv('TEMPO_EARN_VAULT', '0x0D136e26B4D9e4836fc5cb202baeb49Cb6f5df48')
    vi.stubEnv('TEMPO_NETWORK', 'mainnet')
    vi.stubEnv('TEAMPOT_STORAGE_NAMESPACE', 'teampot-ousd-test')
    vi.stubEnv('DEMO_MODE', 'off')
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.com')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test')
    const get = vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(null).mockRejectedValue(new Error('offline'))
    const evalMock = vi.fn().mockResolvedValue(1)
    vi.doMock('@upstash/redis', () => ({ Redis: class { get = get; eval = evalMock } }))
    try {
      const Store = await import('./store.js')
      await Store.load({ fresh: true })
      expect(get.mock.calls.map(c => c[0])).toEqual(['teampot-ousd-test:version', 'teampot-ousd-test:state'])
      await Store.save({ version: 1 }, 0)
      expect(evalMock.mock.calls[0][1]).toEqual(['teampot-ousd-test:state', 'teampot-ousd-test:version'])
      await expect(Store.load({ fresh: true })).rejects.toMatchObject({ status: 503 })
      await expect(Store.save({ version: 2 })).rejects.toMatchObject({ status: 503 })
      const action = vi.fn()
      await expect(Store.withWriteLock(action)).rejects.toMatchObject({ status: 503 })
      expect(action).not.toHaveBeenCalled()
    } finally { vi.unstubAllEnvs(); vi.doUnmock('@upstash/redis') }
  })
})
