import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await (await b.newContext({ viewport:{width:1440,height:900} })).newPage()
await p.goto('http://localhost:8787/', { waitUntil: 'networkidle' })
const tree = p.locator('.lp-tree'); await tree.scrollIntoViewIfNeeded()
for (const t of [300, 1500, 3600, 4400]) { await p.waitForTimeout(t === 300 ? 300 : t - [300,1500,3600,4400][[300,1500,3600,4400].indexOf(t)-1]); await tree.screenshot({ path: `/tmp/tempo-study/tree-${t}.png` }) }
const art = p.locator('.lp-art').nth(1); await art.scrollIntoViewIfNeeded(); await p.waitForTimeout(2200); await p.locator('.lp-cards').screenshot({ path: '/tmp/tempo-study/cards-anim.png' })
await b.close()
