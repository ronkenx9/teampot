# Confidential payroll and surplus earn

Local implementation, October 14, 2026. These changes do not activate private payroll or move real funds.

## What is implemented

Finance can require confidential payroll. That setting pauses payroll at the API and disables the button: without an authorized, verified Zone route the app will not send a public payment. Returning to public payments requires Finance to acknowledge public visibility. Legacy public mode remains the default so existing testnet demonstrations continue to work. Employee pay records, receipt endpoints and CSV exports omit the shared batch hash; Finance retains its audit record. Hiding a link does not make the blockchain confidential.

Finance can approve surplus earning separately for the treasury and each department. The reserve calculation keeps the next full payroll (treasury only), all submitted invoices, held requests, an extra Finance-defined cash reserve and a $1 fee buffer out of Earn. Treasury conservatively covers all open invoices/requests; department reserves also cover their own obligations. This deliberately double-reserves some items rather than risking payroll. Future work may assign a single funding source per liability. Removed employees do not enter payroll reserves.

The reserve is an application rule on new Earn deposits, not a chain-enforced spending restriction or a solvency guarantee. Existing card payments and other withdrawals can consume cash. New liabilities can make an existing reserve inadequate; the next Earn deposit rechecks current cash and obligations. No automatic sweeps or automatic vault withdrawals are enabled.

Only Finance can approve/change policies. A department head can deposit an approved surplus or withdraw their department's position. No policy is enabled by default. Disabling deposits does not lock withdrawals. Testnet simulations move no funds and accrue no returns; they reserve simulated amounts from later simulated deposits. Mainnet refuses simulation.

## Morpho integration

The announced Sentora OUSD Main vault is a Morpho Vault V2, not the Tempo Earn wrapper previously assumed by the app. The new adapter uses the official Morpho SDK 6.0.0. Before preparing a transaction it checks chain ID, underlying asset, six-decimal denomination and dead-share protection. The SDK bounds share-price movement to 0.5%. Approval, vault action and cleanup of newly introduced allowances are sent as one atomic Tempo batch. Failed receipts are never treated as success.

Valuation comes from owned shares and `convertToAssets`. Morpho V2 deliberately returns zero for `maxWithdraw`; that is not its actual liquidity. Teampot conservatively offers the lesser of position value and idle underlying assets in the vault. This is an estimate, not guaranteed execution: gates and concurrent transactions can still make a withdrawal revert. No force withdrawals, allocator rebalancing, in-kind redemptions or queued exits are implemented. RPC failure is shown as unavailable rather than a zero balance.

Read-only deployment evidence is in `work/privacy-earn/deployment-probe.json`. It verifies:

- Tempo mainnet chain 4217.
- Vault `0x0D136e26B4D9e4836fc5cb202baeb49Cb6f5df48`.
- OUSD asset `0x20c0000000000000000000006a37da5c996874be`, six decimals.
- Required dead shares and the SDK's deployed VaultBundlesV1 transaction target.

The existing Teampot payment asset is pathUSD, `0x20c0000000000000000000000000000000000000`. An OUSD vault with pathUSD payment configuration fails validation. No automatic swap, migration, token conversion or production configuration change was performed.

## Activation still required

### Confidential payroll

The user confirmed no Zones preview access. Current official docs say the permissioned runtime has encrypted funding but no general TIP-20 transfers. The old sandbox uses different interfaces and plaintext deposits. It must not be used to claim production confidentiality.

Get operator access, supported assets, signing/encryption tooling, account-scoped RPC access and a supported private payroll method. Verify sender, recipient, another employee and an unauthenticated observer separately. Public deposit/withdrawal amounts remain visible; the Zone operator sees the ledger. Confirm private credit, refund handling and recipient withdrawal before enabling this route. Existing server-held demo keys and demo role selection also need a production custody/authentication review. No configuration flag currently bypasses the payroll block.

### Live surplus earning

Use an isolated OUSD deployment and a separate state store; do not change the payment asset under an existing pathUSD ledger. The optional `TEMPO_PAYMENT_TOKEN` exists for that deployment, not in-place conversion. The API rejects a state store bound to another token or network. Required configuration for the announced vault:

```
TEMPO_NETWORK=mainnet
TEMPO_PAYMENT_TOKEN=0x20c0000000000000000000006a37da5c996874be
TEMPO_EARN_KIND=morpho
TEMPO_EARN_VAULT=0x0D136e26B4D9e4836fc5cb202baeb49Cb6f5df48
```

Configuration is not acceptance evidence. Before any production rollout, fund an authorized staging account with OUSD, verify a small deposit and withdrawal, reconcile actual receipts/shares/balances, and test failure paths. Also verify the fee token is supported and available. This task did not fund or transact on mainnet, change production environment variables, or deploy.

## Request recovery

Live moves require an idempotency key and healthy shared Redis storage; mainnet rejects demo sessions. After preflight, a durable intent is saved before sending. Repeated completed requests return the existing result; a reused key with another payload is rejected. An uncertain submission pauses all further vault operations for that account, even with a new key. It does not book a withdrawal as spendable cash. Do not clear pending records or change vaults to retry blindly.

An operator must reconcile the pending operation against the account's chain history, receipt and vault events, and current balances; record the confirmed result in the state store or establish that no transaction can still settle before releasing it. There is no user-facing automatic recovery flow. This conservative manual recovery remains part of the production acceptance work. State persistence uses the existing store and lock; a production deployment must use durable shared storage and monitor its health rather than rely on memory fallback.

## Verification

- API tests cover permissions, confidential-mode block, explicit public acknowledgement, employee receipt/CSV scoping, reserve boundaries, fresh cash, policy pause, idempotency and uncertain withdrawal retries.
- Adapter tests cover wrong asset/chain/decimals, invalid amounts, unavailable liquidity, missing dead shares, atomic call construction and failed receipts.
- Browser tests use the real built UI and API handlers with mocked chain/storage at 375px and 1280px. They prove product flows, not on-chain settlement.
- `work/privacy-earn/GATES.md` records runnable evidence and the two external activation handoffs.

Sources: [current Zones preview](https://tempo.xyz/developers/docs/zones), [encrypted deposits](https://tempo.xyz/developers/docs/zones/deposit), [Morpho vault](https://app.morpho.org/tempo/vault/0x0D136e26B4D9e4836fc5cb202baeb49Cb6f5df48/sentora-ousd-main), [Morpho SDK](https://docs.morpho.org/developers/sdks/morpho-sdk/), [Vault V2 contract](https://github.com/morpho-org/vault-v2/blob/main/src/VaultV2.sol).

## Isolated OUSD activation preparation

Use `app/.env.ousd.example` for a separate deployment. Mainnet startup now requires a unique storage namespace, demo sign-in disabled, and Redis credentials. State, version, lock, waitlist and analytics keys use that namespace. Mainnet Redis errors stop requests with a storage error; they cannot fall back to public Blob, local files or memory. These checks are necessary boundaries, not a complete production onboarding system.

Inspect a selected public wallet without signing or sending:

```sh
cd app
npx tsx scripts/earn-preflight.ts <public-wallet-address> [fee-token-address]
```

The report validates the mainnet vault asset and lists OUSD, vault shares, idle vault liquidity and optionally a nominated fee-token balance. It does not prove fee-token eligibility or enough gas, and it always reports live earning as unverified. No account has been selected for this isolated deployment yet. Do not repurpose the demo setup endpoint or demo signing secret for real payroll. Production authentication/onboarding, funding and an authorized deposit/withdrawal round trip remain required before activation.
