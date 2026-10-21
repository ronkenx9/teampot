import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { toQR } from 'toqr';
const out = '../work/iphone-test';
mkdirSync(out, { recursive: true });
const headers = { 'expo-platform': 'ios', accept: 'application/expo+json' };
const response = await fetch('http://127.0.0.1:8084/', { headers, signal: AbortSignal.timeout(20000) });
assert(response.ok, 'Expo server unavailable');
const manifest = await response.json();
assert.equal(manifest.extra?.expoClient?.sdkVersion, '57.0.0');
const host = manifest.extra.expoClient.hostUri;
assert(/^[a-zA-Z0-9.-]+\.exp\.direct$/.test(host), 'Expected the running Expo tunnel host');
const remote = await fetch(`https://${host}/`, { headers, signal: AbortSignal.timeout(30000) });
assert(remote.ok, 'External Expo tunnel unavailable');
const externalManifest = await remote.json();
assert.equal(externalManifest.extra.expoClient.hostUri,host);
const bundleUrl = new URL(externalManifest.launchAsset.url);
assert.equal(bundleUrl.hostname,host);
bundleUrl.protocol='https:';
const bundle = await fetch(bundleUrl, { signal: AbortSignal.timeout(120000) });
assert(bundle.ok,'iOS development bundle did not compile');
const bytes = await bundle.arrayBuffer();
assert(bytes.byteLength>10000, 'Unexpectedly empty iOS bundle');
const url = `exp://${host}`;
const matrix=toQR(url), n=Math.sqrt(matrix.length);
assert(Number.isInteger(n));
// Rasterize this technical QR directly: 4-module quiet zone, 8px integer cells.
const scale=8, dimension=(n+8)*scale;
const raw=Buffer.alloc((dimension+1)*dimension,255);
for(let y=0;y<dimension;y++) { raw[y*(dimension+1)]=0; for(let x=0;x<dimension;x++){const mx=Math.floor(x/scale)-4,my=Math.floor(y/scale)-4; if(mx>=0&&my>=0&&mx<n&&my<n&&matrix[my*n+mx]) raw[y*(dimension+1)+1+x]=0;}}
function crc(buffer){let c=0xffffffff;for(const byte of buffer){c^=byte;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type),size=Buffer.alloc(4),sum=Buffer.alloc(4);size.writeUInt32BE(data.length);sum.writeUInt32BE(crc(Buffer.concat([name,data])));return Buffer.concat([size,name,data,sum]);}
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(dimension,0);ihdr.writeUInt32BE(dimension,4);ihdr[8]=8;
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
writeFileSync(`${out}/iphone-qr.png`,png);
writeFileSync(`${out}/connection.json`,JSON.stringify({checkedAt:new Date().toISOString(),url,sdk:'57.0.0',bundleBytes:bytes.byteLength,externalManifestVerified:true,deviceConfirmed:false},null,2)+'\n');
console.log('PHONE_LINK_READY',url);
