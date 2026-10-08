import * as T from '../server/tempo.ts'
import { Account, createClient } from 'viem/tempo'
import { tempoModerato } from 'viem/tempo/chains'
import { http } from 'viem'
const chain: any = (tempoModerato as any).extend({ feeToken: T.TOKEN })
const pk = T.newKeyPk(); const vendor = T.newAddress()
await T.issueKey(pk, 100, 3600, [vendor])
const key = Account.fromP256(pk, { access: T.companyAccount } as any)
const k: any = createClient({ account: key, chain, transport: http(), testnet: true } as any)
const t = (label: string, args: any) => k.token.transferSync({ token: T.TOKEN, to: vendor, amount: T.usd(1), ...args }).then(() => console.log(label, 'ok'), (e: any) => console.log(label, 'ERR', (e.shortMessage || e.message).split('\n')[0], e.details?.slice?.(0, 150) ?? ''))
await t('memo only', { memo: T.memo('design:test') })
await t('feePayer only', { feePayer: T.companyAccount })
await t('memo+feePayer', { memo: T.memo('design:test'), feePayer: T.companyAccount })
