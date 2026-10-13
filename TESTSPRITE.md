# TestSprite on Teampot

Every pull request runs Teampot's TestSprite suite against the live app at https://www.teampot.xyz. A failing or skipped test fails the `TestSprite e2e` check, and branch protection makes that check block the merge.

Workflow: [.github/workflows/testsprite.yml](.github/workflows/testsprite.yml) (uses `TestSprite/testsprite-action@v1`).

## One-time setup (owner)

1. Sign in to the TestSprite portal with the email used for the hackathon submission.
2. Create a project for `https://www.teampot.xyz` and generate the test suite in the 3.0 portal (use the V3 path so frontend tests run instead of being skipped). Suggested coverage is listed below.
3. Create an API key. In GitHub → Settings → Secrets and variables → Actions:
   - secret `TESTSPRITE_API_KEY` = the API key
   - variable `TESTSPRITE_PROJECT_ID` = the project ID
4. Settings → Branches → protect `main` → require the `TestSprite e2e` status check.
5. Open a pull request. The check runs, posts one annotation per failing test on the Checks tab and a results table in the job summary.

## Suggested suite coverage

| Flow | What the test asserts |
|---|---|
| Landing | Website loads, "Open app" reaches `/app` |
| Guided tour | `/tour` steps through to the end card |
| Finance: payday | Batch payday runs and every line shows a receipt |
| Lead: pot spend | A spend inside the cap succeeds |
| Lead: blocked spend | A spend outside the allowlist or over the cap shows "Held for approval", not a payment |
| Finance: approve / return | A held spend can be approved (counted against the pot) or returned |
| Contractor | Invoice → approve & pay → receipt links to the explorer |
| Employee (phone) | Balance and recent pay render on a mobile viewport |

The chain-enforced rejection (blocked spend → held for approval) is the most valuable test: it proves the app's core promise on every change.
