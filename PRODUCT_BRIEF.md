# Teampot pass 4: product-ready (Codex brief)

Rules from BUILD_BRIEF.md still apply: testnet only; never touch app/.env.deploy, app/.env.local or app/.vercel; never deploy or push; no AI attribution; never claim on-chain behaviour without a test or tx. Git is read-only in your sandbox, so leave changes uncommitted. Use PORT=8790.

Read ORG_BRIEF.md, app/HANDOFF.md, app/VERIFIED.md and the code first. The product is "Every team runs its own money". Departments are real funded accounts that issue their team's keys; Finance sets the frame; everyone uses their phone.

Take each feature to its logical conclusion so a real company could start using Teampot tomorrow.

## 1. Real sign-in (highest priority)
Today anyone can "View as" anyone. Keep that only as an explicit **Demo mode**: a toggle, on by default for the public demo, with a visible "Demo" chip. Add real sessions:
- **Sign-in:** people sign in with their passkey (Face ID / Touch ID). The server issues a challenge, verifies the WebAuthn assertion against the stored public key, and sets an HTTP-only, secure, SameSite session cookie. No passwords.
- **Invites:** Finance (or a department head, for their own department) adds a person and gets an invite link (one-time, expiring token). The person opens it on their phone, taps "Set up Face ID", and lands in their wallet. That passkey becomes both their login and their department-issued spending key. Zero other onboarding.
- **Authorization:** every API call is authorized by the session's role (Finance / head of dept X / member / contractor), not by a `viewer` param. In Demo mode the switcher sets a demo session. Write unit tests for the authorization matrix.

## 2. Company setup in 60 seconds
For a fresh company (no seed): a first-run flow.
1. Company name.
2. Fund the company account (testnet: a faucet button, clearly labelled test money).
3. Add departments with budgets and heads.
4. Invite people.
Keep the Northwind Studio seed as the demo.

## 3. Finance rules
Implement a "Payments over $X need Finance" company rule. Department-issued keys get a per-payment ceiling so the chain refuses bigger payments, if Tempo supports per-transaction caps; otherwise enforce it in the app and say so in VERIFIED.md. The refused payment becomes a Finance decision.

## 4. Departments, all the way
- Department heads can invite and remove members. Removing someone revokes their key on-chain.
- Contractors belong to a department and are paid from it.
- Department settings: name, colour, head, budget top-up request to Finance (a decision for Finance).
- Each department gets its own activity export.

## 5. Robustness
- **Concurrent writes across serverless instances:** add optimistic versioning to state saves (reject or retry when the base version changed) so two people acting at once never lose an update. Add a test.
- **Rate limiting** on sign-in, invite, setup and reset.
- **Logging:** structured error logging without secrets.
- **`/api/health`.**

## 6. Mobile as an app
- A PWA manifest (use the icons in brand/logo-v4/final/web), installable, with a theme colour and an offline shell that says "You're offline".
- Fast first paint: show cached state immediately, then refresh.

## Gates
All existing gates in app/GATES.md must pass (update them for auth). New gates:
- **G9 Auth:** e2e signs in with a headless WebAuthn passkey, gets a session, is refused another department's data, and an invite link onboards a new member who can then spend.
- **G10 Concurrency:** a test proves no lost update under concurrent writes.
- **G11 Finance rule:** an over-ceiling payment becomes a Finance decision.

Update README, VERIFIED (real vs app-enforced) and HANDOFF ("pass 4").
