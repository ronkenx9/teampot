// Mine a TIP-1022 virtual-master salt for the company account (proof of work: first 4 bytes of hash = 0).
import 'dotenv/config'
import { writeFileSync } from 'node:fs'
import { VirtualMaster } from 'ox/tempo'
import { Account } from 'viem/tempo'
const company = Account.fromSecp256k1(process.env.OPERATOR_PK as `0x${string}`)
const t0 = Date.now()
const res = await VirtualMaster.mineSaltAsync({ address: company.address as any, workers: 8, start: 4294967296n, onProgress: (p: any) => { if (Math.random() < 0.002) console.log('progress', JSON.stringify(p, (_, x) => typeof x === 'bigint' ? x.toString() : x)) } } as any)
console.log('done', (Date.now() - t0) / 1000, 's', JSON.stringify(res, (_, x) => typeof x === 'bigint' ? x.toString() : x))
if (res) writeFileSync('salt.json', JSON.stringify(res, (_, x) => typeof x === 'bigint' ? x.toString() : x))
