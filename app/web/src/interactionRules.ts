/** Input rules shared by payment controls. Money accepts at most two decimal places. */
export function positiveAmount(value: string | number): boolean {
  return /^\d+(?:\.\d{1,2})?$/.test(String(value).trim()) && Number.isFinite(Number(value)) && Number(value) > 0
}
export function amountIssue(value: string | number, available?: number): string {
  if (!positiveAmount(value)) return 'Enter an amount greater than zero, with up to 2 decimal places.'
  if (available !== undefined && (!Number.isFinite(available) || Number(value) > available)) return 'This is more than the available balance. Choose a smaller amount.'
  return ''
}
export function percentValid(value: string): boolean {
  return /^\d+(?:\.\d{1,2})?$/.test(value.trim()) && Number(value) >= 0 && Number(value) <= 100
}
