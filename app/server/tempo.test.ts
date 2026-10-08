import { beforeAll, describe, expect, it } from 'vitest'
import { encodeAbiParameters, encodeEventTopics, erc20Abi } from 'viem'

beforeAll(() => {
  process.env.OPERATOR_PK = `0x${'11'.repeat(32)}`
})

describe('verifySpend receipt parsing', () => {
  it('accepts an exact company-to-recipient transfer', async () => {
    const T = await import('./tempo.js')
    const to = '0x00000000000000000000000000000000000000aa'
    const topics = encodeEventTopics({ abi: erc20Abi, eventName: 'Transfer', args: { from: T.companyAccount.address, to } })
    const data = encodeAbiParameters([{ type: 'uint256' }], [T.usd(42)])
    expect(T.receiptHasSpend({ status: 'success', logs: [{ address: T.TOKEN, topics, data }] }, to, 42)).toBe(true)
  })

  it('rejects failed, wrong recipient, wrong amount and wrong asset receipts', async () => {
    const T = await import('./tempo.js')
    const to = '0x00000000000000000000000000000000000000aa'
    const other = '0x00000000000000000000000000000000000000bb'
    const topics = encodeEventTopics({ abi: erc20Abi, eventName: 'Transfer', args: { from: T.companyAccount.address, to } })
    const data = encodeAbiParameters([{ type: 'uint256' }], [T.usd(42)])
    const okLog = { address: T.TOKEN, topics, data }
    expect(T.receiptHasSpend({ status: 'reverted', logs: [okLog] }, to, 42)).toBe(false)
    expect(T.receiptHasSpend({ status: 'success', logs: [okLog] }, other, 42)).toBe(false)
    expect(T.receiptHasSpend({ status: 'success', logs: [okLog] }, to, 43)).toBe(false)
    expect(T.receiptHasSpend({ status: 'success', logs: [{ ...okLog, address: other }] }, to, 42)).toBe(false)
  })
})
