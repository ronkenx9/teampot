# Teampot iOS beta — current handoff

The older Expo proof of concept is now the private testnet beta foundation (2026-10-20). Use [BETA.md](BETA.md) for the release procedure and remaining prerequisites.

Implemented: welcoming intro → local name → beta role onboarding, system light/dark appearance, reduced-motion-aware artwork, verified testnet sessions, role-specific tabs and route guards, sign-out, retry states, validated payment/invoice forms, payment review, approval payment confirmation, Finance payday confirmation, current Geist typography and safe-area layout. Live Earn stays off. Real company onboarding opens the separate web application.

Requests retain an unresolved action ID after a timeout and block different actions until the original result is reconciled. Native credentials use SecureStore. Browser checks use controlled API responses and cannot prove native credential storage or biometric behavior. Device payments fail closed when biometric hardware/enrollment is unavailable; they never silently skip that check.

This is source and build preparation, not a distributed binary. Apple membership is not yet available; full Xcode and iOS Simulator are not installed on the development Mac. Real device installation, VoiceOver/text scaling/keyboard tests, biometric testing and signing remain open.

Foundation evidence is under `../work/ios-beta/`; onboarding and light/dark screenshots and browser results are under `../work/native-onboarding/`. The Expo Go tunnel and QR are documented in `../work/iphone-test/STATUS.md`; physical iPhone opening is still awaiting owner confirmation. The legacy `screenshot:sam` helper predates explicit beta entry; use `npm run test:beta` for current automated UI coverage.
