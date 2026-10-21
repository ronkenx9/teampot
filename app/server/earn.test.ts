import { describe, it, expect, vi } from 'vitest'
import { decodeFunctionData, erc20Abi } from 'viem'
import { surplus, vaultAdapter, requireSuccessfulReceipt, SENTORA_OUSD } from './earn.js'
import type { State } from './domain.js'

const address = '0x0000000000000000000000000000000000000001'
const hash = `0x${'12'.repeat(32)}`
const config = { ...SENTORA_OUSD, kind: 'morpho' as const }
function clientFixture() {
  const build = vi.fn(() => ({ to: address, data: '0xab', value: 0n }))
  const requirements = vi.fn(async () => [{ to: config.asset, data: '0xcd', value: 0n, action: { type: 'erc20Approval', args: { spender: address, amount: 10_000_000n } } }])
  const deposit = vi.fn(() => ({ getRequirements: requirements, buildTx: build }))
  const withdraw = vi.fn(() => ({ getRequirements: requirements, buildTx: build }))
  const client: any = {
    account: { address }, getChainId: vi.fn(async () => 4217),
    readContract: vi.fn(async (r: any) => {
      if (r.functionName === 'asset') return config.asset
      if (r.functionName === 'decimals') return 6
      if (r.functionName === 'balanceOf' && r.args[0].toLowerCase().endsWith('dead')) return 10n ** 18n
      if (r.functionName === 'balanceOf') return 50_000_000n
      if (r.functionName === 'convertToAssets') return 100_000_000n
      throw new Error(`Unexpected read ${r.functionName}`)
    }),
    extend: () => ({ morpho: { vaultV2: () => ({ getData: async () => ({}), deposit, withdraw }) } }),
    sendTransactionSync: vi.fn(async () => ({ status: 'success', transactionHash: hash })),
  }
  return { client, deposit, withdraw, requirements }
}

describe('Surplus calculations and Morpho adapter', () => {
  it('protects payroll, unpaid invoices, held requests, fees and the Finance reserve', () => {
    const s = { company: { earnPolicy: { enabled: true, cashReserve: 100 } }, pots: [], people: [{ id: 'a', salary: 200 }, { id: 'b', salary: 900, removed: true }], invoices: [{ status: 'submitted', amount: 50 }, { status: 'paid', amount: 999 }], held: [{ status: 'held', amount: 20 }, { status: 'returned', amount: 900 }] } as unknown as State
    expect(surplus(s, 'company', 1000, 10)).toMatchObject({ payroll: 200, invoices: 50, requests: 20, protectedCash: 371, available: 619 })
    expect(surplus(s, 'company', NaN).available).toBe(0)
    expect(surplus(s, 'company', 10).available).toBe(0)
  })
  it('rejects mismatched assets, networks and decimals before any funds move', async () => {
    const { client } = clientFixture()
    await expect(vaultAdapter({ ...config, asset: address }, client).move('deposit', 10)).rejects.toThrow('asset does not match')
    client.getChainId.mockResolvedValue(42431)
    await expect(vaultAdapter(config, client).move('deposit', 10)).rejects.toThrow('wrong network')
    client.getChainId.mockResolvedValue(4217)
    const original = client.readContract.getMockImplementation()
    client.readContract.mockImplementation((r: any) => r.functionName === 'decimals' ? 18 : original(r))
    await expect(vaultAdapter(config, client).move('deposit', 10)).rejects.toThrow('six-decimal')
    expect(client.sendTransactionSync).not.toHaveBeenCalled()
  })
  it('uses idle underlying liquidity, since Morpho V2 maxWithdraw is always zero', async () => {
    const { client } = clientFixture()
    expect(await vaultAdapter(config, client).position(address)).toEqual({ balance: 100, withdrawable: 50 })
    await expect(vaultAdapter(config, client).move('withdraw', 51)).rejects.toThrow('liquidity')
    expect(client.sendTransactionSync).not.toHaveBeenCalled()
    client.readContract.mockRejectedValue(new Error('RPC down'))
    await expect(vaultAdapter(config, client).position(address)).rejects.toThrow('RPC down')
  })
  it('sends bounded SDK operations and approval cleanup in a single atomic Tempo transaction', async () => {
    const { client, deposit } = clientFixture()
    expect(await vaultAdapter(config, client).move('deposit', 10)).toBe(hash)
    expect(deposit).toHaveBeenCalledWith(expect.objectContaining({ amount: 10_000_000n, userAddress: address, slippageTolerance: 5_000_000_000_000_000n }))
    const calls = client.sendTransactionSync.mock.calls[0][0].calls
    expect(calls).toHaveLength(3)
    expect(decodeFunctionData({ abi: erc20Abi, data: calls[2].data })).toMatchObject({ functionName: 'approve', args: [address, 0n] })
    expect(client.sendTransactionSync).toHaveBeenCalledTimes(1)
  })
  it('rejects failed receipts, missing dead-share protection and invalid amounts', async () => {
    expect(() => requireSuccessfulReceipt({ status: 'reverted', transactionHash: hash })).toThrow('did not confirm')
    expect(() => requireSuccessfulReceipt({ status: 'success' })).toThrow('did not confirm')
    const { client } = clientFixture()
    client.sendTransactionSync.mockResolvedValue({ status: 'reverted', transactionHash: hash })
    await expect(vaultAdapter(config, client).move('deposit', 10)).rejects.toThrow('did not confirm')
    for (const value of [0, NaN, Infinity, -1, 0.001]) await expect(vaultAdapter(config, client).move('deposit', value)).rejects.toThrow('positive amount')
    const original = client.readContract.getMockImplementation()
    client.readContract.mockImplementation((r: any) => r.functionName === 'balanceOf' && r.args[0].toLowerCase().endsWith('dead') ? 0n : original(r))
    await expect(vaultAdapter(config, client).move('deposit', 10)).rejects.toThrow('inflation protection')
  })
})
