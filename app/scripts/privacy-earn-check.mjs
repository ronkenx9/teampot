import { spawnSync } from 'node:child_process'
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--config', 'scripts/privacy-earn-vitest.mjs'], {
  cwd: process.cwd(), stdio: 'inherit', env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: './.cache/ms-playwright' },
})
if (result.status === 0) console.log('PRIVACY_EARN_UI_OK')
process.exit(result.status ?? 1)
