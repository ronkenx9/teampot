# TestSprite on Teampot

Every pull request is tested against its own Vercel preview by the TestSprite GitHub App. When a PR opens or updates, TestSprite runs Teampot's suite against that PR's preview URL and posts the result on the PR. With **Block PR until tests pass** on, a failing suite holds the merge. Production is never the target of a PR check, so a bug is caught before it ships.

## Setup (owner, in the TestSprite 3.0 portal)

All of this must be done from the same TestSprite account that submits the hackathon entry.

1. **Vercel first** (project settings):
   - Build and Deployment → **Root Directory = `app`**. Git-triggered builds currently fail at the repo root (`Could not read package.json`), so no preview ever goes live.
   - Deployment Protection: previews sit behind Vercel sign-in, which TestSprite's browser can't pass. Turn protection off for previews, or use Protection Bypass for Automation.
2. **Project + suite:** create a frontend project for `https://www.teampot.xyz` and generate the test suite in the portal. Suggested coverage is below.
3. **Connect GitHub:** Workspace Settings → Connections → Integrations → GitHub → Connect → only `ronkenx9/teampot` → Install & Authorize.
4. **PR trigger:** project → GitHub Action tab → Add Trigger → Pull request:
   - Target URL pattern: `https://teampot-git-{branch-slug}-ronins-projects-c7d07daa.vercel.app` (Vercel's per-branch preview alias)
   - **Block PR until tests pass:** on
   - Use **Send Test Event** to confirm a run queues.
5. Optional push trigger on `main` against the production environment, so every merge is re-checked live.

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
