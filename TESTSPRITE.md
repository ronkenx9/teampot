# TestSprite on Teampot

Every pull request is tested against its own Vercel preview. When Vercel reports a preview deployment as live, the workflow runs the whole TestSprite suite against that preview URL (`test run --all --target-url`). A failing test fails the `TestSprite e2e` check on the PR's commit, and branch protection holds the merge. Production is never the target of a PR check, so a bug is caught before it ships.

Workflow: [.github/workflows/testsprite.yml](.github/workflows/testsprite.yml). It calls the TestSprite CLI directly because the GitHub Action only accepts a target URL for a single test. It uploads the JUnit report and summary JSON, annotates the Checks tab, and writes a results table to the job summary. You can also start it by hand against any URL (defaults to production).

## One-time setup (owner)

Vercel (both are project settings):
1. Settings → Build and Deployment → **Root Directory = `app`**. Git-triggered builds currently fail at the repo root (`Could not read package.json`), so no preview ever goes live.
2. Settings → Deployment Protection: previews are behind Vercel sign-in, so TestSprite's browser can't reach them. Turn protection off for previews (simplest), or keep it on and use Protection Bypass for Automation.

TestSprite, all from the terminal:
```bash
npx @testsprite/testsprite-cli setup --no-agent          # paste your API key (create it in the TestSprite portal)
npx @testsprite/testsprite-cli project create --type frontend --name Teampot --url https://www.teampot.xyz
npx @testsprite/testsprite-cli test plan generate --project <project-id>   # V3 accounts; review the proposals
npx @testsprite/testsprite-cli test plan accept ...                        # keep the ones you want
```

GitHub:
```bash
gh secret set TESTSPRITE_API_KEY            # paste the key when prompted
gh variable set TESTSPRITE_PROJECT_ID --body <project-id>
```
Then protect `main` and require the `TestSprite e2e` check.

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
