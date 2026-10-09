# Teampot iOS Handoff

## What Was Built

- New Expo Router app in `mobile/`.
- Demo persona picker for Finance, Ava, Sam, and Mateo.
- Native cookie session flow for `/api/auth/demo`: reads `set-cookie`, stores the session with `expo-secure-store`, and sends it as a `cookie` header on native requests.
- Sam Money screen with balance, Spend, Keep & Earn, live Invest controls, held-for-approval feedback, and recent activity.
- Vendor payment flow guarded by `expo-local-authentication`; Face ID/passcode is used on real devices when available.
- Pay-to-stocks on the Invest card: AAPL (test), NVDA (test), and SPY (test) picker; 0/10/20/30% payday election chips; delayed price labels; holdings with shares, value, and gain/loss.
- Manual investing actions: Buy $50 and Sell are both routed through the Face ID/passcode confirmation sheet before calling `/api/invest/trade`.
- Ava approvals queue with approve, approve-and-add-vendor, and return actions.
- Approval decisions now send the current persona id as `approverId`.
- Mateo invoice submission and invoice status.
- Finance read-only company map and Run Payday confirmation.
- Brand v4 colors, logo paths rendered through `react-native-svg`, Expo app icon/splash copied from `brand/logo-v4/final/renders/`.
- Web export screenshot gate script at `mobile/scripts/screenshot-sam.mjs`.
- Removed local representative state and all action fallbacks. If the API is unreachable, the app shows "Can't reach Teampot" with Retry instead of showing fabricated payments, approvals, invoices, or holdings.

## Notes

- `EXPO_PUBLIC_API_BASE` defaults to `https://teampot.vercel.app`.
- Expo web cannot reliably use the production cookie flow cross-origin because browsers block JS access to `set-cookie` and the live API does not answer CORS preflight. The app now fails honestly on web in that case with the Retry state. Native Expo Go uses the real API path.
- Investment types mirror the web client: `Stock`, `Investment`, `EarnEntry`, `stocks`, `investments`, and `earnEntries`.
- The Face ID helper only prompts when hardware and enrollment exist. Expo web and devices without enrolled biometrics continue after the in-app confirmation sheet.

## Gates

Run from `mobile/`:

```sh
npm install
npx tsc --noEmit
npx expo export --platform web
npm run screenshot:sam
```

Expected screenshot output:

```text
mobile/screenshots/sam-money.png
```

## Gate Results From This Machine

- `npx tsc --noEmit` passed after pass 6C.
- `npx expo export --platform web` passed after pass 6C and wrote `mobile/dist`.
- `npx expo start --host lan --port 8081` hit this machine's macOS watcher limit (`EMFILE: too many open files, watch`). A CI-mode server can run with `ulimit -n 65536 && CI=1 HOME=$PWD/.home npm_config_cache=$PWD/.npm-cache npx expo start --host lan --port 8081`; install Watchman for normal hot reload.
- `npm run screenshot:sam` could serve the export, but Chromium cannot launch in this sandbox even after installing browsers locally under `mobile/.playwright-browsers`. Playwright fails before page load with:

```text
FATAL:base/apple/mach_port_rendezvous_mac.cc:159
bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer... Permission denied (1100)
```

Claude or a non-sandboxed local shell can rerun:

```sh
cd mobile
PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers npx playwright install chromium
npm run screenshot:sam
```
