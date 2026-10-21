# Activation preparation review

- Complete: separate OUSD environment template, mainnet startup boundaries, namespaced persistence and public-address inspection script.
- Depth: isolated Redis keys include locks, versions, waitlist and statistics; mainnet never writes public Blob or falls back to files after Redis failure.
- Correctness: tests cover incorrect asset, default namespace, demo authentication, missing storage credentials and a Redis outage followed by attempted save/write action. Full application suite and type checks pass.
- Polish: documented exact inspection command and remaining launch blockers. Preflight deliberately reports readiness false; optional nominated fee-token balance is not proof of fee eligibility or sufficiency.

Unverified: selected-account RPC report and funded deposit/withdrawal round trip. No wallet selected, no signing secret loaded, no deployment or financial transaction performed. Production authentication/onboarding remains outside this preparation and blocks launch.
