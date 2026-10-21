export type PayrollPrivacy = 'public' | 'confidential'
export const ZONE_ACCESS_MESSAGE = 'Confidential payroll is unavailable: Tempo Zones preview access and a verified private payroll deployment are required. No public payment will be sent.'
export function payrollPrivacy(mode: PayrollPrivacy = 'public') {
  return {
    mode, available: false, status: 'access-required' as const,
    blocked: mode === 'confidential',
    message: mode === 'confidential' ? ZONE_ACCESS_MESSAGE : 'Payments are public on Tempo. Teampot limits access in the app, but that does not hide blockchain transactions.',
    visibility: 'For a supported Zone deployment, Finance, the recipient and the Zone operator can see the payment. Public deposits and withdrawals still expose amounts.',
  }
}
export function assertPayrollRoute(mode: PayrollPrivacy = 'public') {
  if (mode === 'confidential') throw Object.assign(new Error(ZONE_ACCESS_MESSAGE), { status: 409 })
}
