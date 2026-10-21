import { describe, it, expect } from 'vitest'
import { positiveAmount, amountIssue, percentValid } from '../web/src/interactionRules.js'
describe('interaction prerequisites', () => {
  it('rejects malformed, non-finite, negative and sub-cent money', () => {
    for (const v of ['', ' ', '0', '-1', '1.2.3', 'Infinity', 'NaN', '0.001']) expect(positiveAmount(v)).toBe(false)
    for (const v of ['0.01', '20', '12.50']) expect(positiveAmount(v)).toBe(true)
    expect(amountIssue('20', 19)).not.toBe('')
    expect(amountIssue('20', 20)).toBe('')
    expect(amountIssue('20', NaN)).not.toBe('')
  })
  it('accepts zero to turn off allocation, but never over 100 percent', () => {
    for (const v of ['0', '20', '100']) expect(percentValid(v)).toBe(true)
    for (const v of ['', '-1', '101', '1.2.3', 'Infinity']) expect(percentValid(v)).toBe(false)
  })
})
