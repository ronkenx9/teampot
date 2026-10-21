# Teampot iOS beta

The native app is being prepared for private testing on Tempo testnet. It opens with three short welcome slides, then your name, then your role. Your name stays on this device and personalizes the greeting; signing out clears it. Every screen follows system light/dark appearance and onboarding respects Reduce Motion. Demo people represent shared test accounts, not a tester's company or personal wallet. Real company onboarding remains a separate browser experience; it is not native account sign-in. Live earning and real money are unavailable in this beta.

## Local development

From the repository root:

```sh
cd mobile
npm ci
npx expo start
```

Use a compatible Expo Go client for basic screen testing, or a native build for device behavior. The project currently uses Expo SDK 57; the current App Store Expo Go version may support a different SDK. Face ID cannot be verified in Expo Go on iOS. Use a native build on an enrolled device to test it.

If Metro reaches the macOS watcher limit, install Watchman or raise the shell's open-file limit before starting:

```sh
ulimit -n 65536
npx expo start
```

The default API is `https://teampot.vercel.app`. Copy `.env.example` to `.env.local` only when overriding the endpoint. `EXPO_PUBLIC_` values are visible in the app bundle; never put credentials in them. A different endpoint must still return an authenticated demo session and explicitly identify testnet. Shared demo mutations can affect other testers.

Native sessions use Expo SecureStore. Session expiry returns the tester to sign-in; the app must not create a new demo session silently. Browser exports use browser cookies and are for UI verification. Production API cross-origin browser cookie/CORS behavior is not proof of native session behavior.

## Verify locally

```sh
npm run typecheck
node scripts/check-release.mjs
npx expo export --platform ios --output-dir dist-ios
```

The export checks the iOS JavaScript and assets. It does **not** compile an `.app` or `.ipa`, exercise native APIs, sign a build, or upload to TestFlight.

## Build and distribute

The owner has chosen private internal testing first and does not yet have Apple Developer membership. TestFlight remains a release handoff; this preparation does not distribute the app.

`eas.json` contains a `simulator` profile and a `beta` profile for TestFlight. Neither has been built or submitted by adding these files. See [BETA.md](BETA.md) for account setup, exact commands, required device checks, and release blockers.

## Test on an iPhone without paid Apple membership

As checked on 2026-10-20, App Store Expo Go 57 matches this SDK57 project. Install Expo Go and sign into the same free Expo account on the Mac and phone. On the Mac, `npx expo login --browser` handles sign-in without putting a password into chat.

```sh
CI=1 npx expo start --go --tunnel --port 8084
```

Keep that process and the Mac awake while testing. CI mode avoids the previous watcher-limit issue; automatic hot reload is disabled. A server restart may change the tunnel address. With the server running, `node scripts/phone-link.mjs` verifies the iOS tunnel/bundle and regenerates `../work/iphone-test/iphone-qr.png`. Scan it with the iPhone Camera and open in Expo Go. Internet access is needed; the tunnel does not require matching Wi-Fi networks.

This runs inside Expo Go rather than installing a standalone Teampot binary. Face ID is not supported by Expo Go; test screens, role flows, login/session restoration and sign-out first. Do not interpret an unavailable biometric prompt as permission to bypass payment confirmation. Test funds only.
