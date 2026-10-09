# iOS pass 6C: invest and honesty fixes (Codex brief)

Only edit inside mobile/. Rules from IOS_BRIEF.md apply. Git is read-only; no deploy.

The server now has a personal wallet with pay-to-stocks. Read its types in app/web/src/api.ts (Stock, Investment, earnEntries, and the `election` and `trade` calls) and the routes in app/server/app.ts (`/api/invest/election`, `/api/invest/trade`, and the `/api/held/:id/:action` body, which now REQUIRES `approverId`).

1. **Types and API.** Mirror Stock, Investment, earnEntries and stocks into mobile/src/types.ts. Add `api.election(...)` and `api.trade(...)`, and pass `approverId` (the current persona's id) in `decide`.
2. **Invest on the Money screen** (testID `sam-money-invest`):
   - a pay-to-stocks control: stock picker (AAPL / NVDA / SPY) and share-of-pay chips (0 / 10 / 20 / 30%), saved with `election`
   - holdings with shares, value and gain/loss, from the API
   - Buy $50 and Sell actions, behind the Face ID confirm
   Label prices "delayed" and the assets "(test)", exactly as the API names them.
3. **Honesty.** Remove every fabricated fallback: no local fake held payments, and no silent fallbackState shown as if it were real. If the API is unreachable, show a clear "Can't reach Teampot" state with Retry. Delete fallbackState if nothing legitimate needs it.
4. **Layout.** Fix the "Native confirmation uses Face ID…" line that overflows its card at 390 px, and the odd default amount (83). Use a sensible default such as 45.
5. **Gates:**
   - `npx tsc --noEmit` passes
   - `npx expo export --platform web` succeeds
   - Update mobile/HANDOFF.md
