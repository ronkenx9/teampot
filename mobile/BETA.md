# Teampot iOS beta release guide

The owner confirmed on 2026-10-20 that this beta is for private internal testers first and that Apple Developer membership is not yet available. TestFlight distribution is therefore blocked until membership and signing are set up; local development and simulator preparation can continue.

This is the first native beta slice: explicit testnet entry, demo role workflows, session handling and local build preparation. It does not connect real company accounts to money movement. It does not enable OUSD earning or confidential payroll. Zcash is outside scope.

## Build identities

| Setting | Value |
|---|---|
| Display name | Teampot Beta |
| Bundle identifier | `xyz.teampot.app` (existing project identifier; Apple registration still needs verification) |
| App version | `0.1.0` |
| Initial iOS build | `1`; EAS uses remote build numbers and increments beta builds |
| URL scheme | `teampot` |
| Default API | `https://teampot.vercel.app` |
| Simulator profile | `simulator`, independent of Expo Go |
| TestFlight profile | `beta`, store distribution |

The API boundary enforces authenticated testnet demo sessions. A build profile name or API URL is not a safety boundary by itself. Never replace the endpoint with a mainnet deployment as a way to activate money features.

## What the current checks prove

- Type checking verifies the app's TypeScript contracts.
- The release configuration check verifies profile relationships, identifiers, required asset files and declared native permissions.
- An iOS Expo export verifies JavaScript/assets bundling only.
- Browser UI checks exercise React Native Web views with controlled responses. They do not verify iOS SecureStore, Face ID, keyboard behavior, installation or backgrounding.
- A successful native build is still distinct from a successful device test and TestFlight distribution.

No native binary, signing credential, Apple app record or TestFlight upload is created by these configuration files. Full Xcode/iOS Simulator was unavailable on the development Mac when this guide was written; only Command Line Tools were selected.

## Account and signing setup

Before starting a cloud build, use the owner's Expo account and link this directory to the intended EAS project. No Expo project ID or Apple team ID is guessed in the repository.

From `mobile/`, the owner or an authorized release operator can run:

```sh
npx eas-cli login
npx eas-cli whoami
npx eas-cli init
npx eas-cli project:info
```

`eas init` links or creates an external Expo project and can add its project ID to app configuration. Select the intended owner/project, review the resulting diff, and keep signing secrets out of the repository. If linking configuration changes, update the release configuration check to recognize the verified project ID.

TestFlight also needs Apple Developer Program membership, access to the correct App Store Connect team, an app record associated with `xyz.teampot.app`, and valid signing credentials. Confirm bundle ownership before provisioning. Complete Apple's requested privacy, export-compliance and beta information using the app's actual behavior. This repository does not assert an encryption exemption or invent a privacy-policy URL.

## Simulator build

A simulator build does not require Apple Developer membership. Running it locally requires full Xcode and an installed iOS Simulator runtime. After Expo project linking:

```sh
npx eas-cli build --platform ios --profile simulator
npx eas-cli build:run --platform ios --latest
```

Check that the selected artifact is the simulator build. A simulator cannot establish real-device biometric behavior. The simulator profile does not enable a development client and therefore does not depend on `expo-dev-client`.

## TestFlight build and upload

After device-validation planning, account setup and signing are ready:

```sh
npx eas-cli build --platform ios --profile beta
```

Review the specific successful build before uploading it. Run submit separately to select that build:

```sh
npx eas-cli submit --platform ios --profile beta
```

Apple must process the upload before testers can install it. TestFlight internal testers must belong to the App Store Connect team; external testers use Apple's external testing process and may need Beta App Review. “Internal distribution” in EAS means ad hoc/enterprise distribution and is different from TestFlight internal testing. The `beta` profile intentionally uses `distribution: store`.

## Device acceptance checklist

Record device model, iOS version, app/build version, API environment and observed result. Do not include session cookies or passkey material in reports.

- Fresh install shows short welcome slides, name, then role; no automatic shared-persona sign-in. Name remains local; sign-out clears it. Verify light/dark changes, Reduce Motion, back navigation and keyboard reachability.
- Selecting each demo role shows its appropriate screens. Direct navigation to an unavailable role screen does not reveal privileged content or permit actions.
- Relaunch restores a valid session. Expired/revoked sessions require sign-in. Signing out clears local credentials and screen data; relaunch remains signed out.
- Airplane mode and slow/recovered connectivity show useful retry states without invented balances. Retrying a read does not repeat a payment.
- Repeated taps cannot launch overlapping mutations. An uncertain payment outcome is handled visibly before any retry.
- Invalid, blank, zero, negative and excessive amounts are blocked. Verify the recipient/vendor and amount in confirmation before sending test funds.
- Canceling Face ID/device authentication sends no payment. Test enrolled, unenrolled and unavailable authentication states on a real device; accurately label fallback behavior.
- Test each role's core task: employee test purchase, lead approval/return, contractor invoice, Finance payday confirmation. Use only test funds and capture the resulting visible state/receipt.
- Verify safe areas, text scaling, VoiceOver labels, keyboard dismissal, scroll reachability, background/resume and portrait layouts on both a smaller and larger iPhone.
- Check that live Earn and confidential payroll are not claimed as active. Real onboarding links clearly leave the demo for the browser.

Do not mark this checklist passed from JavaScript bundling or browser screenshots. Keep actual results with the build record.

## Before inviting real companies

Native real-account authentication, production payment-account connection, recovery, membership enforcement and account lifecycle need their own implemented and verified flow. Existing web passkeys do not automatically authenticate this native client. OUSD earning additionally requires its funded round-trip validation; confidential payroll still requires a supported private route. Resolve these separately before describing the beta as a real-money product.

## Official references

- [Expo simulator builds](https://docs.expo.dev/build-reference/simulators/)
- [EAS build profile configuration](https://docs.expo.dev/build/eas-json/)
- [TestFlight distribution](https://docs.expo.dev/submit/testflight/)
- [Expo local authentication limitations](https://docs.expo.dev/versions/latest/sdk/local-authentication/)

Reviewed for this preparation on 2026-10-20. Follow current account prompts during release; project linking, credentials and distribution remain owner-controlled external steps.

## Dependency review before distribution

The 2026-10-20 npm audit snapshot in `../work/ios-beta/dependency-audit.json` reports 29 advisory entries (18 high, 11 moderate, no critical), including transitive build tooling and routing dependencies. Compatible Expo patch alignment passes but does not clear these advisories. Triage and remediate the applicable dependency paths before distributing a build; the suggested forced framework downgrades are not an approved fix.
