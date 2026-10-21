// Read-only deployment probe: never signs, approves or submits a transaction.
import { createPublicClient, http, erc20Abi, parseAbi } from 'viem'
import { tempo } from 'viem/tempo/chains'
import { morphoViemExtension } from '@morpho-org/morpho-sdk'
import { writeFileSync } from 'node:fs'
import { SENTORA_OUSD } from '../server/earn.js'
const client = createPublicClient({ chain: tempo, transport: http('https://rpc.tempo.xyz') }).extend(morphoViemExtension({ supportSignature: false }))
const account = '0x0000000000000000000000000000000000000001'
const vault = client.morpho.vaultV2(SENTORA_OUSD.vault, SENTORA_OUSD.chainId)
const data = await vault.getData()
const asset = await client.readContract({ address: SENTORA_OUSD.vault, abi: parseAbi(['function asset() view returns(address)']), functionName: 'asset' })
if (asset.toLowerCase() !== SENTORA_OUSD.asset.toLowerCase()) throw new Error('Official vault asset changed')
const decimals = await client.readContract({ address: asset, abi: erc20Abi, functionName: 'decimals' })
const symbol = await client.readContract({ address: asset, abi: erc20Abi, functionName: 'symbol' })
const deadShares = await client.readContract({ address: SENTORA_OUSD.vault, abi: erc20Abi, functionName: 'balanceOf', args: ['0x000000000000000000000000000000000000dEaD'] })
const deposit = vault.deposit({ amount: 1_000_000n, userAddress: account, vaultData: data, slippageTolerance: 5_000_000_000_000_000n })
const requirements = await deposit.getRequirements()
const tx = deposit.buildTx()
const bundlesCode = await client.getCode({ address: tx.to })
if (!bundlesCode || bundlesCode === '0x') throw new Error('SDK bundle target is not deployed')
if (decimals !== 6 || symbol !== 'OUSD' || deadShares < 10n ** 18n) throw new Error('Asset or dead-share verification failed')
const report = { checkedAt: new Date().toISOString(), chainId: await client.getChainId(), vault: SENTORA_OUSD.vault, asset, symbol, decimals, deadShares: deadShares.toString(), bundles: tx.to, approvalCount: requirements.length, sdkBuild: true, roundTrip: false, note: 'Read-only probe. No funds moved. OUSD differs from the existing pathUSD payment asset.' }
writeFileSync('../work/privacy-earn/deployment-probe.json', JSON.stringify(report, null, 2) + '\n')
console.log('EARN_DEPLOYMENT_READS_OK', JSON.stringify(report))
