// Public-account inspection only. No signing keys, approvals, or transactions.
import { createPublicClient, erc20Abi, http, isAddress, parseAbi } from 'viem'
import { tempo } from 'viem/tempo/chains'
import { SENTORA_OUSD } from '../server/earn.js'
const account = process.argv[2]
if (!account || !isAddress(account) || /^0x0{40}$/i.test(account)) {
  console.error('Usage: npx tsx scripts/earn-preflight.ts <public-wallet-address> [fee-token-address]')
  process.exit(1)
}
const feeToken = process.argv[3]
if (feeToken && !isAddress(feeToken)) throw new Error('Invalid fee token address')
const client = createPublicClient({ chain: tempo, transport: http('https://rpc.tempo.xyz') })
const [chainId, asset, decimals, balance, shares, idle] = await Promise.all([
  client.getChainId(),
  client.readContract({ address: SENTORA_OUSD.vault, abi: parseAbi(['function asset() view returns(address)']), functionName: 'asset' }),
  client.readContract({ address: SENTORA_OUSD.asset, abi: erc20Abi, functionName: 'decimals' }),
  client.readContract({ address: SENTORA_OUSD.asset, abi: erc20Abi, functionName: 'balanceOf', args: [account] }),
  client.readContract({ address: SENTORA_OUSD.vault, abi: erc20Abi, functionName: 'balanceOf', args: [account] }),
  client.readContract({ address: SENTORA_OUSD.asset, abi: erc20Abi, functionName: 'balanceOf', args: [SENTORA_OUSD.vault] }),
])
if (chainId !== SENTORA_OUSD.chainId || asset.toLowerCase() !== SENTORA_OUSD.asset.toLowerCase() || decimals !== 6) throw new Error('Deployment asset mismatch')
const feeBalance = feeToken ? await client.readContract({ address: feeToken as `0x${string}`, abi: erc20Abi, functionName: 'balanceOf', args: [account] }) : null
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), account, chainId, vault: SENTORA_OUSD.vault, asset, decimals, ousdAtomic: balance.toString(), vaultShares: shares.toString(), idleOusdAtomic: idle.toString(), feeToken: feeToken ?? null, feeTokenBalanceAtomic: feeBalance?.toString() ?? null, funded: balance > 0n, readyForLiveEarn: false, roundTripVerified: false, note: 'Fee-token eligibility, transaction fee sufficiency, account authorization and a funded round trip still require verification. No funds moved.' }, null, 2))
