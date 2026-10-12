# Plugging in a card issuer (Stripe Issuing) and Tempo Earn

Teampot runs both of these in **simulated mode** today. Everything around them is built and tested, so going live is configuration, not new code.

## Visa cards through Stripe Issuing

### What already works (simulated)
- **Get your Visa card** (Spend tab) issues a simulated virtual card. When a card is issued, the person's Tempo card is re-signed by the head key to add the card network's settlement account as one more allowed payee.
- **Tap at a shop** runs the same decision a live swipe runs (`authorizeCard` in `app/server/app.ts`):
  1. The merchant category (MCC) is mapped to a Teampot vendor category (`app/server/issuing.ts`).
  2. That category must be on the department card.
  3. The amount must be under the Finance limit, else it goes to Finance.
  4. The amount must fit the card's remaining monthly limit, read from Tempo.
- **Approved** payments settle for real on Tempo: the department account pays the settlement account, signed by the person's own card key, so Tempo enforces the limit again.
- **Declined** payments become an "approve once" request to the head, like a held Tempo payment. Approving it pays the settlement account from the department with the head key.
- Verified on Moderato in `npm run e2e` and `npm run audit`.

### Going live
1. Get Stripe Issuing approved on your Stripe account (Issuing is invite or approval based). Stablecoin-backed card programs run through Stripe and Bridge.
2. Set these environment variables on the Vercel project (`app/`):

| Variable | Value |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` first, then `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | the signing secret of the webhook below (`whsec_…`) |
| `ISSUING_SETTLEMENT_ACCOUNT` | the Tempo account that funds your issuing balance (where card spend settles) |
| `ISSUING_BILLING_ADDRESS` | JSON billing address for cardholders, e.g. `{"line1":"…","city":"…","state":"CA","postal_code":"…","country":"US"}` |

3. In the Stripe Dashboard, add a webhook endpoint at `https://<your-domain>/api/issuing/webhook` for:
   - `issuing_authorization.request`: real-time authorization. Teampot answers `{"approved": true|false}` within Stripe's time limit, using the same `authorizeCard` checks.
   - `issuing_transaction.created`: on a capture, Teampot settles the amount on Tempo from the department account.
4. With `STRIPE_SECRET_KEY` set, **Get your Visa card** creates a real Stripe cardholder and a virtual card (`issueVisaCard`), and the app stops showing "Simulated".
5. Test in Stripe test mode: create a test authorization for the card from the Dashboard (Issuing → test helpers). You should see the approve/decline appear in Teampot's activity and, on capture, a settlement payment on Tempo.

### Rules on both rails

| Check | On Tempo (direct payment) | At a shop (Visa) |
|---|---|---|
| Monthly limit | Tempo access key limit | Tempo remaining limit at authorization, then the card key again at settlement |
| Allowed vendors | Tempo recipient allowlist | Merchant category must match a vendor category on the card |
| Finance limit | Teampot | Teampot |
| Decline | becomes a request to the head | becomes a request to the head |

Signature verification: `verifyStripeSignature` (HMAC-SHA256 over `t.payload`, 5-minute tolerance), covered by unit tests.

## Idle budgets earn (Tempo Earn)

- **Simulated** (default): Finance or the head puts part of a department's budget to work; Teampot records it and nothing moves. The UI says "Simulated on testnet".
- **Real**: set `TEMPO_EARN_VAULT` to a Tempo Earn vault (ERC-4626). "Put to work" then calls `earn.deposit` from the department account (Finance signs with the department root, a head with the head key). "Bring back" calls `earn.withdrawExact`, and the balance shown is the vault position's live value (`earn.getPosition`).
- **Mainnet**: `TEMPO_NETWORK=mainnet` switches the chain, the explorer links and the RPC (override with `TEMPO_RPC`, `TEMPO_EXPLORER`). Mainnet is real money: fund `OPERATOR_PK` on mainnet and start with small amounts.

| Variable | Value |
|---|---|
| `TEMPO_NETWORK` | `mainnet` or unset (Moderato testnet) |
| `TEMPO_EARN_VAULT` | the Earn vault for pathUSD |
| `TEMPO_RPC`, `TEMPO_EXPLORER` | optional overrides |

## Agent cards (live today)

A head gives an AI agent its own card: a monthly limit and vendor list, signed by the head key, enforced by Tempo. The agent pays with its agent key:

```bash
curl -X POST https://www.teampot.xyz/api/agent/pay \
  -H "Authorization: Bearer tpa_…" -H "content-type: application/json" \
  -d '{"vendorId":"adobe-fonts","amount":12,"note":"Font license"}'
```

On-card purchases go straight through on Tempo. Anything off the card, or over the limit, waits for the head. "Approve + add" adds the vendor to the agent's card and re-signs it. Removing the agent revokes its card on Tempo.

## Bank rails: money in and out (Bridge)

Companies keep their bank. Teampot sits between the bank and their people.

- **Money in.** Finance taps *Add money*. With Bridge connected, the company gets a real deposit account (a Bridge virtual account); ACH or wire transfers into it land in the treasury on Tempo as dollars, automatically.
- **Money out.** Anyone can link a bank and *Cash out*: Teampot sends the dollars on Tempo to that bank's Bridge liquidation address, and Bridge pays the bank by ACH. Finance can *Withdraw* from the treasury to the company bank the same way. Teampot stores only the bank name and last four digits.
- **Simulated mode (today).** Without Bridge keys, a "bank desk" account on Tempo testnet plays Bridge: deposits really land in the treasury on-chain, and cash-outs really leave the person's balance on-chain; only the bank leg is simulated.

| Env | What |
|---|---|
| `BRIDGE_API_KEY` | Turns on real bank rails |
| `BRIDGE_CUSTOMER_ID` | The company's KYB'd Bridge customer (treasury deposits and withdrawals) |
| `BRIDGE_RAIL` | Chain Bridge settles on (default `tempo`) |
| `BRIDGE_CURRENCY` | Stablecoin Bridge settles in (default `usdc`) |

Employee cash-outs with real rails need each person to be a verified Bridge customer (`bridgeCustomerId` on the person, set after Bridge KYC).

## Analytics

- Vercel Web Analytics is injected on every public page (enable it once in the Vercel project's Analytics tab).
- Teampot's own cookie-free counter (`POST /api/hit`) records page views, daily unique visitors (salted daily hash), top pages and referrers in Redis for 90 days.
- `/stats` is the private dashboard: waitlist total, signups today/this week, roles, team sizes, sources, traffic. It asks for `WAITLIST_TOKEN` and sends it as a header only.
