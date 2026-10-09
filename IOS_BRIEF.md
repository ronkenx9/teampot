# Teampot pass 6B: iOS app (Codex brief)

Only write inside `mobile/` at the repo root. No deploy, no push, no AI attribution; git is read-only. Never read app/.env.deploy, app/.env.local or app/.vercel.

There's no Xcode on this machine, so build an **Expo (React Native, TypeScript, Expo Router)** app that runs on a real iPhone through Expo Go, and in a browser through Expo web for testing.

- **API:** the live API at https://teampot.vercel.app (endpoints in app/server/app.ts; the web client is app/web/src/api.ts). Sessions are an HTTP-only cookie. On native, read the `set-cookie` from `/api/auth/demo` and send it as a `cookie` header, stored in expo-secure-store. Support the demo personas (Finance, Ava, Sam, Mateo) through a "Demo" picker. Make the API base configurable through `EXPO_PUBLIC_API_BASE` (default https://teampot.vercel.app).
- **Screens:**
  - Sam (employee): a Money home with total balance, Spend (Design card), Keep and Earn, Invest (holdings and pay-to-stocks, if the API exposes them; otherwise show a placeholder section that reads from the API when available), and recent activity.
  - Pay a vendor, with a native confirmation sheet guarded by expo-local-authentication (Face ID on device), then the existing spend API.
  - Held-for-approval feedback.
  - Ava (head): needs-your-OK approvals.
  - Mateo (contractor): send an invoice, invoice status.
  - Finance: a read-only overview (company map: departments and their budgets) plus Run payday with a confirm step.
- **Design:** match brand v4. The locked logo SVGs are in brand/logo-v4/final/; use react-native-svg. Palette: Clay #E8552D (accent), Ink #141414, Paper #F6F4F0. Inter Tight via expo-font (@expo-google-fonts/inter-tight), with ExtraBold Italic for money. Calm, native-feeling, bottom tabs, large money numbers, haptics on success.
- **App metadata:** the app icon and splash come from brand/logo-v4/final (teampot-app-icon.svg rendered to PNG). Name "Teampot", bundle id xyz.teampot.app.
- **Run and test:**
  - `npx expo start` for Expo Go.
  - `npx expo export --platform web` must succeed.
  - Add `mobile/README.md` with exact steps to open it on an iPhone with Expo Go (same Wi-Fi, or `--tunnel`), and a note on a native build later (EAS needs an Expo account).
- **Gates:**
  - `npx tsc --noEmit` passes.
  - `npx expo export --platform web` succeeds.
  - Write a small script that serves the web export and has Playwright screenshot the Sam Money screen at 390×844 into mobile/screenshots/. If the browser can't launch in your sandbox, say so; Claude will run it.
  - Write mobile/HANDOFF.md.
