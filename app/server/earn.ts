import { encodeFunctionData, erc20Abi, formatUnits, isAddress, parseAbi, parseUnits } from 'viem'
import { morphoViemExtension, isRequirementSignature } from '@morpho-org/morpho-sdk'
import { roundMoney, type State } from './domain.js'

export type EarnPolicy = { enabled: boolean; cashReserve: number; approvedBy: string; updatedAt: number }
export type EarnPosition = { mode: 'simulated' | 'real'; balance: number; updatedAt: number; tx?: string; vault?: string }
export const SENTORA_OUSD = { chainId: 4217, vault: '0x0D136e26B4D9e4836fc5cb202baeb49Cb6f5df48', asset: '0x20c0000000000000000000006a37da5c996874be' } as const
export const FEE_RESERVE = 1
export const RISK_NOTICE = 'Returns vary and losses are possible. Withdrawals depend on available vault liquidity. Money earning is not available to spend until a withdrawal confirms.'
export const defaultPolicy = (): EarnPolicy => ({ enabled: false, cashReserve: 0, approvedBy: '', updatedAt: 0 })

/** Conservative obligations: reserve all submitted invoices and held requests, even before approval. */
export function surplus(s: State, scope: string, cash: number, simulated = 0) {
  const company = scope === 'company'
  const policy = (company ? s.company.earnPolicy : s.pots.find((p) => p.id === scope)?.earnPolicy) ?? defaultPolicy()
  const payroll = company ? s.people.filter((p) => !p.removed && p.salary).reduce((n, p) => n + p.salary!, 0) : 0
  const invoices = s.invoices.filter((i) => i.status === 'submitted' && (company || s.people.find((p) => p.id === i.contractorId)?.team === scope)).reduce((n, i) => n + i.amount, 0)
  const requests = s.held.filter((h) => h.status === 'held' && (company || h.potId === scope)).reduce((n, h) => n + h.amount, 0)
  const protectedCash = roundMoney(policy.cashReserve + payroll + invoices + requests + FEE_RESERVE)
  const available = Number.isFinite(cash) ? roundMoney(Math.max(0, cash - simulated - protectedCash)) : 0
  return { policy, payroll: roundMoney(payroll), invoices: roundMoney(invoices), requests: roundMoney(requests), feeReserve: FEE_RESERVE, protectedCash, available, cash }
}

const vaultAbi = parseAbi([
  'function asset() view returns (address)',
  'function balanceOf(address) view returns (uint256)',
  'function convertToAssets(uint256) view returns (uint256)',
  'function maxWithdraw(address) view returns (uint256)',
  'function previewDeposit(uint256) view returns (uint256)',
  'function previewWithdraw(uint256) view returns (uint256)',
])
export type VaultConfig = { vault: string; kind: 'morpho'; asset: string; chainId: number }
export function vaultConfig(asset: string, chainId: number): VaultConfig | null {
  const vault = process.env.TEMPO_EARN_VAULT
  if (!vault) return null
  if (!isAddress(vault)) throw new Error('Invalid earn vault address')
  const kind = process.env.TEMPO_EARN_KIND ?? 'morpho'
  if (kind !== 'morpho') throw new Error('This surplus adapter requires a Morpho ERC-4626 vault, not a Tempo Earn wrapper')
  return { vault, kind, asset, chainId }
}
export function requireSuccessfulReceipt(r: any) {
  const receipt = r.receipt ?? r
  if (receipt.status !== 'success' || !/^0x[0-9a-f]{64}$/i.test(receipt.transactionHash ?? '')) throw new Error('Vault transaction did not confirm successfully')
  return receipt.transactionHash as string
}

/** Morpho ERC-4626 integration. A Tempo Earn wrapper has a different interface. */
export function vaultAdapter(config: VaultConfig, client: any) {
  const read = (functionName: string, args: unknown[] = []) => client.readContract({ address: config.vault, abi: vaultAbi, functionName, args })
  async function validate() {
    if (!isAddress(config.vault) || !isAddress(config.asset)) throw new Error('Invalid vault configuration')
    const [chainId, asset] = await Promise.all([client.getChainId(), read('asset')])
    if (chainId !== config.chainId) throw new Error('Earn RPC is connected to the wrong network')
    if (String(asset).toLowerCase() !== config.asset.toLowerCase()) throw new Error('Vault asset does not match the payment asset. No automatic currency conversion is enabled.')
    const decimals = await client.readContract({ address: asset, abi: erc20Abi, functionName: 'decimals' })
    if (Number(decimals) !== 6) throw new Error('This deployment requires a six-decimal payment asset')
  }
  const units = (amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0 || amount !== roundMoney(amount)) throw new Error('Enter a positive amount with at most two decimal places')
    return parseUnits(amount.toFixed(2), 6)
  }
  async function position(account: string) {
    await validate()
    const value: bigint = await read('convertToAssets', [await read('balanceOf', [account])])
    // Unknown liquidity must stay unknown; a read failure must never appear as zero value.
    // Morpho V2 maxWithdraw intentionally returns zero. Conservatively offer only idle
    // underlying assets; no forced exits, reallocations or in-kind redemptions here.
    const max: bigint = await client.readContract({ address: config.asset, abi: erc20Abi, functionName: 'balanceOf', args: [config.vault] })
    return { balance: Number(formatUnits(value, 6)), withdrawable: Number(formatUnits(max < value ? max : value, 6)) }
  }
  async function prepare(action: 'deposit' | 'withdraw', amount: number) {
    const assets = units(amount)
    await validate()
    const account = client.account.address
    if (action === 'withdraw') {
      const { withdrawable } = await position(account)
      if (amount > withdrawable) throw new Error('Not enough vault liquidity for this withdrawal. Try a smaller amount or try again later.')
    }
    if (action === 'deposit') {
      const deadShares: bigint = await read('balanceOf', ['0x000000000000000000000000000000000000dEaD'])
      if (deadShares < 10n ** 18n) throw new Error('Vault lacks the required dead-share inflation protection')
    }
    const mc = client.extend(morphoViemExtension({ supportSignature: false }))
    const vault = mc.morpho.vaultV2(config.vault, config.chainId)
    const vaultData = await vault.getData()
    const operation = vault[action]({ amount: assets, userAddress: account, vaultData, slippageTolerance: 5_000_000_000_000_000n })
    const requirements = await operation.getRequirements()
    const approvals: { token: string; spender: string }[] = []
    const calls: { to: string; data: string; value: bigint }[] = []
    for (const requirement of requirements) {
      if (isRequirementSignature(requirement)) throw new Error('Unexpected signature requirement')
      if (requirement.action?.type !== 'erc20Approval') throw new Error('Unexpected vault approval requirement')
      approvals.push({ token: requirement.to, spender: requirement.action.args.spender })
      calls.push({ to: requirement.to, data: requirement.data, value: requirement.value })
    }
    const tx = operation.buildTx()
    calls.push({ to: tx.to, data: tx.data, value: tx.value })
    // Atomic approval, bounded vault operation and allowance cleanup; no standalone approval transaction.
    for (const a of approvals) calls.push({ to: a.token, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [a.spender as `0x${string}`, 0n] }), value: 0n })
    return () => client.sendTransactionSync({ calls }).then(requireSuccessfulReceipt) as Promise<string>
  }
  async function move(action: 'deposit' | 'withdraw', amount: number) { return (await prepare(action, amount))() }
  return { validate, position, prepare, move }
}
