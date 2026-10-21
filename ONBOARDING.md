# Accounts, onboarding and workspace roles

Real onboarding is at `/app`. The shared testnet demo is at `/demo`; `/tour` embeds that demo. Demo characters and role switching never identify a real user. Older `/app/invite/*` and `/invite/*` links belong to the legacy testnet demo; new company invitations use `/join/<token>`.

## First visit

1. **Create a company:** enter your name and company name, register a passkey, and receive Owner access to a new, empty workspace.
2. **Join a company:** open the invitation, review the assigned role and department, then create an account with a passkey or sign into your existing account. The invitation supplies permissions; the recipient cannot choose a higher role.
3. **Return:** sign in with your passkey. Teampot lists only your active workspace memberships. If you have several companies or roles, switch between those assigned memberships.

Face ID, fingerprints and device PINs can unlock a passkey. A job title (for example, Design Director) is display information, separate from the permission role. Names are not unique identifiers. There is no public picker for real people, no self-selected admin role, and no default demo membership.

## Access matrix

| Assigned role | Scope | Team setup permissions |
| --- | --- | --- |
| Owner | Company | Create departments; invite Finance, leads, employees and contractors; change or revoke non-owner access |
| Finance | Company | Create departments; invite and manage non-owner access |
| Department lead | Assigned department | View that team; invite employees and contractors into that department; revoke those invitations |
| Employee | Own profile | View assigned company, department and job title |
| Contractor | Own profile | View assigned client workspace and job title |

Only creating a new company grants Owner. Owner transfer/deletion is not exposed. Administrators cannot alter their own access through the member editor. The same account may hold multiple memberships; each action uses the currently selected membership, not a union of all roles.

Owners and Finance see access activity. Leads see their department. Employees and contractors see only their own profiles. Every read/write checks the current membership on the server. Removing or reducing access takes effect on the next request; open screens also refresh their account state every 30 seconds while visible.

## Invitations

Links are single-use bearer invitations, expire after seven days, and can be revoked. Share them privately: anyone holding an unused link can accept it into their signed-in account. They are not bound to a verified email address. Invitation names help the sender identify the invitation; the joining account retains its own name. Tokens are stored only as SHA-256 hashes, not plaintext. The original link is shown once after creation; create a new invitation if it is lost.

Acceptance is atomic and uses the stored role, department and workspace. The inviter must still hold permission to grant that access when it is accepted. An expired, used, revoked or no-longer-authorized invitation cannot grant membership. Multiple tabs accepting the same invitation cannot create duplicate grants.

## Isolation and authentication

- `app/server/workspaces.ts`: `/api/accounts/*`, independent of the legacy demo ledger and demo authentication cookies.
- `app/server/workspace-store.ts`: private account directory; UUID workspace and membership IDs; versioned compare-and-swap writes.
- `app/web/src/Workspace.tsx`: real onboarding and role-specific team setup screens.
- `app/web/src/App.tsx`: explicitly labeled shared testnet demo.
- WebAuthn registration and authentication use SimpleWebAuthn with required user verification, discoverable passkeys, and exact challenge, origin and relying-party checks. Failed verification consumes its five-minute challenge.
- Random opaque session tokens are stored hashed; cookies are HttpOnly, SameSite=Lax, Secure on HTTPS, and expire after seven days. Sign-out revokes the server session.
- Writes require matching Origin and JSON; request bodies are limited to 32 KiB. Authentication and invitation creation are rate limited.
- Production account data requires private Redis (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`, or `KV_REST_API_URL` + `KV_REST_API_TOKEN`). Key: `${TEAMPOT_STORAGE_NAMESPACE || 'teampot'}:real-accounts:v1`. Storage failures return an error; they never fall back to public Blob or demo data.
- Development alone can use `TEAMPOT_ACCOUNTS_FILE`, default `data/real-accounts.json`. Do not commit that file. Use a separate storage namespace for preview deployments; otherwise deployments with the same Redis and namespace share accounts.
- Account API responses are not cached. No passkey public keys, challenge/session hashes or invitation hashes are returned in workspace views.

Passkeys are scoped to the domain where they were created. Create and test your account on the same deployment hostname you will use when signing in. This account passkey identifies a person; it is not automatically a Tempo payment signing key.

## Current scope and limitations

Real workspaces support account creation, company and department setup, invitations, assigned role switching, role changes, access revocation and access activity. They start with **no connected payment account**. The financial actions, balances, payday, cards and invoices in the shared testnet demo are not connected to new companies. The real UI explains this rather than displaying demo money as the company's money. Provisioning isolated company treasuries and permissioned payment accounts is a separate integration.

Account recovery, additional-passkey management, email-bound invitations, ownership transfer and organization deletion are not yet exposed. Keep access to your registered/synced passkey. The directory currently uses a single private Redis record with optimistic concurrency; large-scale use will need per-workspace records and a retention policy.

## Verification

From `app/`:

```sh
npm run typecheck
npm --prefix web run build
npm test
```

`server/workspaces.test.ts` covers forged/demo sessions, cross-company access, role restrictions, invitation replay/races/expiry/revocation, reduced access, owner protection, scoped reads, invalid passkeys and origin/body-size checks. Browser verification additionally exercises actual WebAuthn registration and sign-in with a virtual authenticator, owner → lead → employee onboarding, multiple company switching, role changes and narrow mobile layouts.

To test live: open `/app`, create a company, add a department, invite a lead, then open the invitation in another browser profile/device and join. The lead can invite employees or contractors only into their assigned department. Use `/demo` to explore the sample financial workflows.
