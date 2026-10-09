import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const outDir = path.join(root, 'screenshots');
const outFile = path.join(outDir, 'sam-money.png');
const port = Number(process.env.MOBILE_SCREENSHOT_PORT || 4190);

const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.json', 'application/json'],
  ['.ico', 'image/x-icon']
]);

if (!existsSync(path.join(dist, 'index.html'))) {
  console.error('Missing mobile/dist/index.html. Run `npx expo export --platform web` first.');
  process.exit(1);
}

// Same-origin preview: /api/* is proxied to API_UPSTREAM (default: local app server), so web cookies work.
const upstream = process.env.API_UPSTREAM || 'http://localhost:8787'
const server = http.createServer((req, res) => {
  if (req.url?.startsWith('/api/')) {
    const u = new URL(req.url, upstream)
    const proxied = http.request(u, { method: req.method, headers: { ...req.headers, host: u.host } }, (up) => { res.writeHead(up.statusCode || 502, up.headers); up.pipe(res) })
    proxied.on('error', () => { res.writeHead(502); res.end('upstream error') })
    req.pipe(proxied)
    return
  }
  const rawUrl = req.url?.split('?')[0] || '/';
  const safePath = path.normalize(decodeURIComponent(rawUrl)).replace(/^(\.\.[/\\])+/, '');
  let file = path.join(dist, safePath === '/' ? 'index.html' : safePath);
  if (!existsSync(file) || statSync(file).isDirectory()) file = path.join(dist, 'index.html');
  res.setHeader('content-type', types.get(path.extname(file)) || 'application/octet-stream');
  createReadStream(file).pipe(res);
});

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));

try {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
  await page.getByTestId('sam-money-balance').waitFor({ timeout: 15000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: outFile, fullPage: true, animations: 'disabled', timeout: 30000 });
  await browser.close();
  console.log(`Wrote ${path.relative(root, outFile)}`);
} catch (error) {
  console.error('Playwright could not launch or capture the browser in this sandbox.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await new Promise((resolve) => server.close(resolve));
}
