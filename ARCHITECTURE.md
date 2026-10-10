# Teampot architecture: who controls the money

**Pitch:** every team runs its own money. Finance sets the frame, department heads run their department, and everyone pays from their phone. Tempo enforces the limits, not our server.

## 1. Three levels of delegation, each enforced by Tempo

```
Company treasury   (Finance: root key of the company account)
   │  funds with a real transfer: the budget is the department account's balance
   ▼
Department account (one Tempo account per department; root key held by Finance)
   │  Finance authorizes the head's ADMIN access key on it (TIP-1049)
   ▼
Head key           (unrestricted on the department account, so bounded by its balance)
   │  the head signs the authorization of each member card
   ▼
Member cards       (access keys: monthly cap + vendor allowlist; perks are extra cards)
```

| Level | Tempo primitive | Who signs | What it can do | Bounded by |
|---|---|---|---|---|
| Company treasury | Account root key | Finance | Fund or claw back departments; run payday (one batch with memos); pay anything | Company balance |
| Department account | Separate account, root key | Finance | Appoint or remove the head (authorize/revoke admin key); return budget to treasury | Its own balance |
| Head key | Admin access key on the department account | Department head | Issue, re-issue and revoke member cards; approve held payments; pay team contractors | Department balance (what Finance funded) |
| Member card | Access key with `limits` (per period) and `scopes.recipients` | Employee (device passkey, or demo key) | Pay approved vendors up to the cap | Cap per period and vendor list |
| Perk card | Access key with a daily or yearly limit and its own vendors | Employee | Pay e.g. lunch at Uber Eats, $15 a day | Its own cap and vendors |

### Verified on Moderato (`scripts/probe-admin-key.ts`, 2026-10-10)

1. A department root authorized a head key as **admin**.
2. The head key authorized a member card: $10 a month, one vendor.
3. The member paid the vendor $4: **ok**.
4. The member tried to pay $8 (over the cap): **rejected by Tempo**.
5. The member tried to pay an unlisted vendor: **rejected by Tempo**.
6. The head paid the unlisted vendor directly, which is how an approval works: **ok**.
7. The head revoked the member card. The member's next payment was **rejected**.
8. The department root revoked the head key. The head's next payment was **rejected**.

Earlier notes said keys can't create other keys. That was true before T6. Admin keys (TIP-1049) now allow exactly one level of delegation below the head, and that is the level Teampot needs.

## 2. Permission matrix (server rules mirror what Tempo enforces)

| Action | Finance | Head (own dept) | Employee | Contractor | Enforced by |
|---|---|---|---|---|---|
| Fund a department / change its budget | ✅ | ❌ (requests a top-up) | ❌ | ❌ | Tempo: only the treasury key can move treasury money |
| Appoint or remove a head | ✅ | ❌ | ❌ | ❌ | Tempo: department root authorizes or revokes the admin key |
| Run payday, set salaries | ✅ | ❌ | ❌ | ❌ | Tempo: treasury key; server: role check |
| Set member cap and vendor list | ✅ | ✅ (cap ≤ budget) | ❌ | ❌ | Tempo: the new card is signed by the head key |
| Issue, re-issue or revoke cards | ✅ | ✅ | ❌ | ❌ | Tempo: admin key |
| Approve a held payment | ✅ | ✅ (not their own; up to the Finance limit) | ❌ | ❌ | Tempo: the head key pays from the department. Server: own-request and threshold rules |
| Payments over the Finance limit ($1,000) | ✅ | ❌ | ❌ | ❌ | **Server only** (Tempo limits are per period, not per payment) |
| Pay a team contractor's invoice | ✅ | ✅ (up to the Finance limit) | ❌ | ❌ | Tempo: head key, bounded by the department balance |
| Pay a vendor from your card | n/a | ✅ (own card) | ✅ | ❌ | Tempo: cap and allowlist |
| Invite people | ✅ (any role, salary) | ✅ (own team, no salary, no lead role) | ❌ | ❌ | Server |
| Invest your own pay | ✅ | ✅ | ✅ | ✅ | Tempo: personal account on the stablecoin DEX |
| See company-wide money | ✅ | ❌ (own department) | ❌ (own pay and card) | ❌ (own invoices) | Server: scoped `/api/state` |

## 3. Honest limits (said in the UI and docs)

- **Custody.** Department roots and demo keys are derived on the server from the operator secret. In production, the department root would be a Finance multisig (Tempo has native multisig accounts) and every head and member key would be a device passkey. Invited people already use device passkeys.
- **Per-payment threshold.** Tempo limits are per period, so the "over $1,000 needs Finance" rule is enforced by the server.
- **A head key can spend the whole department balance.** That is the frame: Finance decides how much goes in and can revoke the head key or pull the money back at any time.
- **Earn** has no public testnet vault, so it is labelled Simulated. Test stocks are test tokens priced from delayed market data.

## 4. Where it lives in code

- `server/tempo.ts`: `authorizeAdminKey`, `issueKeyVia(signer, parent, …)`, `revokeKeyVia`, `spendWithKeyOn`, `payday`.
- `server/app.ts`: `issueHeadKey`, `issuePotKey` (signed by the head key when the department has a head), and the role checks (`requireFinance`, `requireFinanceOrHead`).
- `/api/state` → `controls`: the delegation tree with account addresses, balances, key issuers and receipts, filtered to what the viewer may see.
