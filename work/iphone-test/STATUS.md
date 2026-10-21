# iPhone connection — 2026-10-20

The Expo Go development server is running on port8084, with an authenticated Expo tunnel. External iOS manifest and bundle checks pass for SDK57; typecheck and Expo version alignment pass. Worklets is pinned to the bundled0.10.1 version.

Connection: exp://i29ofts-roninxx-8084.exp.direct

QR: iphone-qr.png. Independently decoded with Apple's Vision framework; payload exactly matches the connection above.

Owner should install App Store Expo Go, sign in with the same free Expo account used on the Mac, and scan the QR. Keep this Mac awake/server running. CI mode disables automatic hot reload. FaceID is unsupported by Expo Go. No financial actions were performed.

2 runnable gates passed and reverified. Owner's physical-phone confirmation remains pending; do not claim the phone app has opened yet. Connection is temporary and may change on restart.

Latest refresh: 2026-10-20 native onboarding now serves three welcome slides → local name → role, system light/dark across screens, reduced-motion-aware artwork. Local onboarding scope 7/7 gates met (5 runnable reverified, 2 reviewed); see ../native-onboarding/REVIEW.md. Physical phone opening still unconfirmed.
