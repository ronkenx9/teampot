import { describe, expect, it } from 'vitest'
import {
  applyKudosDebit, canAwardKudos, decodeMemoLabel, holdReason, idempotent, invoiceNumber, moneyMemo,
  nextMonthlyDate, normalizeState, potApprovedTotal, potSavings, roundMoney, slug, splitKudos, uid,
  type State,
} from './domain.js'

const state = (): State => ({
  epoch: 'e',
  company: { name: 'Co', address: '0xco' },
  people: [],
  vendors: [],
  pots: [],
  perks: [],
  activity: [],
  held: [],
  invoices: [],
  paydayRuns: [],
  quarterCloses: [],
  kudosCredits: [],
  kudosAwards: [],
  nextPayday: '2026-11-08',
  processed: {},
  seeded: false,
})

describe('pot math and held reasons', () => {
  it('classifies new-vendor and over-limit holds', () => {
    const pot = { id: 'design', team: 'Design', perPersonCap: 100, periodLabel: 'month', periodSec: 1, vendorIds: ['figma'], color: '#000' }
    expect(holdReason(pot, 'figma')).toBe('over-limit')
    expect(holdReason(pot, 'delta')).toBe('new-vendor')
  })

  it('totals approved direct payments against a pot', () => {
    const s = state()
    s.held = [
      { id: '1', at: 1, personId: 'sam', potId: 'design', vendorId: 'figma', amount: 10, note: 'a', reason: 'over-limit', status: 'approved' },
      { id: '2', at: 1, personId: 'sam', potId: 'design', vendorId: 'delta', amount: 5, note: 'b', reason: 'new-vendor', status: 'held' },
      { id: '3', at: 1, personId: 'leo', potId: 'mkt', vendorId: 'delta', amount: 9, note: 'c', reason: 'new-vendor', status: 'approved' },
    ]
    expect(potApprovedTotal(s, 'design')).toBe(10)
    expect(potApprovedTotal(s, 'mkt')).toBe(9)
    expect(potApprovedTotal(s, 'eng')).toBe(0)
  })

  it('computes savings from real remaining limits minus approved spend', () => {
    expect(potSavings([100, 80, 0], 30)).toBe(150)
    expect(potSavings([20], 50)).toBe(0)
    expect(potSavings([19.335, 10.335], 0)).toBe(29.67)
  })
})

describe('quarter close and kudos', () => {
  it('splits the kudos pool with cent remainder handling', () => {
    const split = splitKudos(100, 20, ['ava', 'sam', 'priya'])
    expect(split.pool).toBe(20)
    expect(split.lines).toHaveLength(3)
    expect(split.lines.reduce((a, l) => a + l.amount, 0)).toBeCloseTo(20)
    expect(split.lines[0].amount).toBe(6.67)
    expect(split.lines[2].amount).toBe(6.66)
  })

  it('bounds share percentages and handles empty teams', () => {
    expect(splitKudos(100, 120, ['sam']).pool).toBe(100)
    expect(splitKudos(100, -2, ['sam']).pool).toBe(0)
    expect(splitKudos(100, 20, []).lines).toEqual([])
  })

  it('checks and debits kudos credits across closes', () => {
    const credits = [{ personId: 'sam', closeId: 'a', left: 2 }, { personId: 'sam', closeId: 'b', left: 3 }, { personId: 'ava', closeId: 'a', left: 9 }]
    expect(canAwardKudos(credits, 'sam', 4)).toEqual({ ok: true, left: 5 })
    expect(canAwardKudos(credits, 'sam', 6).ok).toBe(false)
    expect(applyKudosDebit(credits, 'sam', 4)).toBe(true)
    expect(credits.find((c) => c.closeId === 'a')!.left).toBe(0)
    expect(credits.find((c) => c.closeId === 'b')!.left).toBe(1)
    expect(applyKudosDebit(credits, 'sam', 2)).toBe(false)
  })
})

describe('validation helpers and idempotency', () => {
  it('normalizes old states and derives defaults', () => {
    const s = normalizeState({ epoch: 'x', company: { name: 'Co', address: '0x' }, people: [], vendors: [], pots: [], activity: [], held: [], invoices: [], seeded: true } as any, state)
    expect(s.perks).toEqual([])
    expect(s.paydayRuns).toEqual([])
    expect(s.processed).toEqual({})
    expect(s.nextPayday).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('returns the same result for the same idempotency key', () => {
    const s = state()
    let calls = 0
    const first = idempotent(s, 'pay-1', () => ({ calls: ++calls }))
    const second = idempotent(s, 'pay-1', () => ({ calls: ++calls }))
    const third = idempotent(s, undefined, () => ({ calls: ++calls }))
    expect(first).toEqual({ calls: 1 })
    expect(second).toEqual({ calls: 1 })
    expect(third).toEqual({ calls: 2 })
  })

  it('formats slugs, memos, invoice numbers and dates safely', () => {
    expect(slug(' Design Ops!! ')).toBe('design-ops')
    expect(slug('***')).toHaveLength(8)
    expect(moneyMemo('hello '.repeat(10))).toHaveLength(31)
    expect(invoiceNumber([{ id: 'a' } as any, { id: 'b' } as any])).toBe('INV-1043')
    expect(nextMonthlyDate(new Date('2026-01-31T00:00:00Z'))).toBe('2026-02-28')
    expect(roundMoney(1.005)).toBe(1.01)
  })

  it('decodes compact receipt memos', () => {
    expect(decodeMemoLabel('design:font')).toBe('Design pot · font')
    expect(decodeMemoLabel('kudos:huge help')).toBe('Kudos · huge help')
    expect(decodeMemoLabel('plain')).toBe('plain')
    expect(decodeMemoLabel()).toBe('Teampot memo')
  })

  it('creates compact ids', () => {
    expect(uid()).toHaveLength(8)
    expect(uid()).not.toEqual(uid())
  })
})
