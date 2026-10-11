// Builds the demo: live recordings in a phone frame with captions, film intro/outro, VO, music, SFX.
import { chromium } from '/Users/gadgetplug/Documents/vibecoding/teampot/app/node_modules/playwright/index.mjs'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
const FILM = '../film/out/teampot-film-v4.mp4'
const SFX = '../film/assets/sfx'
const MUSIC = '../film/assets/bgm-recall-high.wav'
mkdirSync('build', { recursive: true })
const ff = (args) => execFileSync('ffmpeg', ['-y', '-v', 'error', ...args], { stdio: ['ignore', 'inherit', 'inherit'] })
const dur = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString())

// scene: [id, clips, eyebrow, caption, vo, tail (seconds the clip waited after the key moment), sfx at key moment]
const SCENES = [
  ['home', ['home'], 'Sam · Employee', 'Your pay lands here.', 'home', 0, null],
  ['pay', ['pay'], 'Pay', 'Paid on Tempo in a second.', 'pay', 2.9, ['feedback-correct-15-sba-300286500', -14, 1.6]],
  ['held', ['held'], 'Off the card', 'Tempo says no.', 'held', 2.9, ['low-hit', -15]],
  ['approve', ['approve'], 'Ava · Design head', 'Approve with your head key.', 'approve', 2.5, ['shine', -10]],
  ['agent', ['agent'], 'Agents', 'AI agents get cards too.', 'agent', 2.1, ['coins', -16, 1.0]],
  ['finance', ['finance'], 'Jordan · Finance', 'Every team is its own account.', 'finance', 2.3, ['soft-electronic-hit', -8]],
  ['payday', ['payday'], 'Payday', 'Everyone, one payment.', 'payday', 2.7, ['cash-register', -9, 1.4]],
  ['send', ['send'], 'Send', 'Pay a teammate by @username.', 'send', 1.8, ['coins', -13, 1.3]],
  ['invest', ['invest'], 'Invest', 'Put your pay to work.', 'invest', 1.8, ['cash-register', -13, 1.2]],
  ['visa', ['visa'], 'Visa card', 'Tap at any shop.', 'visa', 2.5, ['feedback-correct-15-sba-300286500', -14, 1.6]],
  ['contractor', ['contractor', 'contractor2'], 'Mateo · Contractor', 'Invoice. Paid in seconds.', 'contractor', 0, null],
]

// 1) overlay layouts (background, caption, phone frame) rendered once per scene
const PHONE = { x: 1170, y: 30, w: 466, h: 1020, pad: 14, strip: 46 }
const SCREEN = { x: PHONE.x + PHONE.pad, y: PHONE.y + PHONE.pad, w: PHONE.w - 2 * PHONE.pad, h: PHONE.h - 2 * PHONE.pad }
const VID = { x: SCREEN.x, y: SCREEN.y + PHONE.strip, w: SCREEN.w, h: SCREEN.h - PHONE.strip }
const b = await chromium.launch()
const pg = await b.newPage({ viewport: { width: 1920, height: 1080 } })
const html = (eyebrow, caption, i, n) => `<!doctype html><html><head><link href="https://fonts.googleapis.com/css2?family=Geist:wght@200;300;400&family=Geist+Mono:wght@400&display=block" rel="stylesheet"><style>
*{margin:0;box-sizing:border-box}body{width:1920px;height:1080px;background:radial-gradient(90% 90% at 70% 50%,#F4F5F7 0%,#E6E8EC 70%);font-family:Geist,sans-serif;overflow:hidden;position:relative}
.cap{position:absolute;left:150px;top:50%;transform:translateY(-50%);width:880px}
.e{font:400 20px/1 "Geist Mono";letter-spacing:.14em;text-transform:uppercase;color:#8A8F95;display:flex;align-items:center;gap:14px;margin-bottom:30px}.e i{width:8px;height:8px;border-radius:50%;background:#E8552D}
.h{font-weight:200;font-size:92px;line-height:1.02;letter-spacing:-.045em;color:#0B0B0C}
.prog{position:absolute;left:150px;bottom:90px;display:flex;gap:8px}.prog b{width:34px;height:3px;border-radius:2px;background:rgba(11,11,12,.12)}.prog b.on{background:#0B0B0C}
.brand{position:absolute;left:150px;top:80px;display:flex;align-items:center;gap:12px;font-size:26px;font-weight:400;letter-spacing:-.03em;color:#0B0B0C}
.phone{position:absolute;left:${PHONE.x}px;top:${PHONE.y}px;width:${PHONE.w}px;height:${PHONE.h}px;border-radius:66px;background:#0B0B0C;box-shadow:0 60px 120px rgba(20,30,50,.22),0 22px 44px rgba(20,30,50,.14),inset 0 0 0 2px #2A2A2C}
.scr{position:absolute;left:${SCREEN.x}px;top:${SCREEN.y}px;width:${SCREEN.w}px;height:${SCREEN.h}px;border-radius:54px;background:#ECEEF1;overflow:hidden}
.scr .t{position:absolute;top:15px;left:36px;font:600 17px/1 Geist;color:#0B0B0C}.scr .isl{position:absolute;top:10px;left:50%;width:118px;height:32px;margin-left:-59px;border-radius:20px;background:#000}
.scr .bat{position:absolute;top:17px;right:30px;width:26px;height:12px;border-radius:3px;border:1.5px solid #0B0B0C}
</style></head><body>
<div class="brand"><svg viewBox="55 176 692 444" width="40" height="26"><path fill="#0B0B0C" d="M58 302 C100 470 240 615 400 615 C560 615 698 470 743 302 C746 292 738 290 731 293 C620 345 510 376 400 376 C290 376 180 345 69 293 C62 290 55 293 58 302 Z"/><path fill="#E8552D" d="M98 207 C220 246 330 252 420 250 C540 247 630 221 690 188 C714 176 724 196 709 216 C640 285 530 318 410 318 C290 318 170 287 99 240 C84 230 86 203 98 207 Z"/></svg>teampot</div>
<div class="cap"><div class="e"><i></i>${eyebrow}</div><div class="h">${caption}</div></div>
<div class="prog">${Array.from({ length: n }, (_, k) => `<b class="${k === i ? 'on' : ''}"></b>`).join('')}</div>
<div class="phone"></div><div class="scr"><span class="t">9:41</span><span class="isl"></span><span class="bat"></span></div>
</body></html>`
for (const [i, [id, , eyebrow, caption]] of SCENES.entries()) {
  await pg.setContent(html(eyebrow, caption, i, SCENES.length), { waitUntil: 'networkidle' })
  await pg.evaluate(() => document.fonts.ready)
  await pg.screenshot({ path: `build/under-${id}.png` })
}
// rounded-bottom mask for the app video
await pg.setContent(`<body style="margin:0;background:transparent"><div style="width:${VID.w}px;height:${VID.h}px;background:#fff;border-radius:0 0 54px 54px"></div></body>`)
await pg.setViewportSize({ width: VID.w, height: VID.h })
await pg.screenshot({ path: 'build/mask.png', omitBackground: true })
await b.close()

// 2) each scene → 1920x1080 30fps clip
const FPS = 30
const timeline = []
const vo = (k) => `vo/${k}.wav`
for (const [id, clips, , , voKey, tail, sfx] of SCENES) {
  // frames → constant-rate video using real screencast timestamps
  const list = []
  for (const c of clips) {
    const { frames } = JSON.parse(readFileSync(`clips/${c}/times.json`, 'utf8'))
    const end = frames[frames.length - 1][1]
    for (let k = 0; k < frames.length; k++) {
      let d = k < frames.length - 1 ? Math.max(0.001, frames[k + 1][1] - frames[k][1]) : 0.6
      // a still screen held over half a second before the final result is dead air (waiting on the network): trim it
      if (frames[k][1] < end - 3.2 && d > 0.5) d = 0.5
      list.push(`file '../clips/${c}/${frames[k][0]}'`, `duration ${d.toFixed(4)}`)
    }
    list.push(`file '../clips/${c}/${frames[frames.length - 1][0]}'`)
  }
  writeFileSync(`build/${id}.txt`, list.join('\n'))
  const raw = `build/${id}-raw.mp4`
  ff(['-f', 'concat', '-safe', '0', '-i', `build/${id}.txt`, '-vf', `fps=${FPS},scale=${VID.w}:${VID.h}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-crf', '14', '-preset', 'fast', raw])
  const clipD = dur(raw), voD = dur(vo(voKey))
  const D = Math.max(clipD, voD + 1.0)
  const out = `build/${id}.mp4`
  ff(['-loop', '1', '-framerate', String(FPS), '-i', `build/under-${id}.png`, '-i', raw, '-i', 'build/mask.png',
    '-filter_complex', `[1:v]tpad=stop_mode=clone:stop_duration=${(D - clipD + 0.2).toFixed(2)},format=rgba[v];[2:v]format=gray[m];[v][m]alphamerge[vm];[0:v][vm]overlay=${VID.x}:${VID.y}:shortest=0,trim=duration=${D.toFixed(3)},setsar=1,format=yuv420p[o]`,
    '-map', '[o]', '-r', String(FPS), '-c:v', 'libx264', '-crf', '15', '-preset', 'fast', out])
  timeline.push({ id, file: out, D, voKey, voD, key: tail ? clipD - tail : null, sfx })
  console.log(`${id}: clip ${clipD.toFixed(1)}s, vo ${voD.toFixed(1)}s → ${D.toFixed(1)}s`)
}

// 3) film intro and outro
ff(['-ss', '18.15', '-t', '6.6', '-i', FILM, '-vf', `fps=${FPS},scale=1920:1080,format=yuv420p`, '-an', '-c:v', 'libx264', '-crf', '15', '-preset', 'fast', 'build/intro.mp4'])
ff(['-ss', '80.55', '-t', '11.6', '-i', FILM, '-vf', `fps=${FPS},scale=1920:1080,format=yuv420p`, '-an', '-c:v', 'libx264', '-crf', '15', '-preset', 'fast', 'build/outro.mp4'])

// 4) join with quick slide transitions
const parts = [{ file: 'build/intro.mp4', D: 6.6 }, ...timeline, { file: 'build/outro.mp4', D: 11.6 }]
const X = 0.35
let fc = '', last = '[0:v]', offset = 0
const starts = [0]
for (let k = 1; k < parts.length; k++) {
  offset += parts[k - 1].D - X
  starts.push(offset)
  const kind = k === 1 || k === parts.length - 1 ? 'fadeblack' : 'smoothleft'
  fc += `${last}[${k}:v]xfade=transition=${kind}:duration=${X}:offset=${offset.toFixed(3)}[x${k}];`
  last = `[x${k}]`
}
const total = offset + parts[parts.length - 1].D
const inputs = parts.flatMap((p) => ['-i', p.file])
ff([...inputs, '-filter_complex', fc.replace(/;$/, ''), '-map', last, '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', '-pix_fmt', 'yuv420p', 'build/video.mp4'])

// 5) audio: VO, SFX, music bed (ducked under the voice)
const cues = [] // [time, file, gainDb, maxLen]
cues.push([0.25, vo('intro'), 0])
timeline.forEach((s, k) => {
  const t0 = starts[k + 1]
  cues.push([t0 + 0.35, vo(s.voKey), 0])
  cues.push([t0 - 0.05, `${SFX}/swoosh.wav`, -20])
  if (s.key !== null && s.sfx) cues.push([t0 + s.key, `${SFX}/${s.sfx[0]}.wav`, s.sfx[1], s.sfx[2]])
})
if (existsSync(vo('contractor'))) { /* contractor sfx: paid pop on the invoices view */ const k = timeline.findIndex((s) => s.id === 'contractor'); cues.push([starts[k + 1] + timeline[k].D - 3.6, `${SFX}/pop.wav`, -12]) }
const tO = starts[starts.length - 1]
cues.push([tO + 0.4, vo('o1'), 0], [tO + 3.1, vo('o2'), 0], [tO + 5.7, vo('o3'), 0], [tO + 8.6, vo('o4'), 0], [tO + 8.5, `${SFX}/deep-hit.wav`, -12, 2.5])
const aIn = ['-i', MUSIC, ...cues.flatMap((c) => ['-i', c[1]])]
let af = `[0:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:${total.toFixed(2)},afade=t=in:d=0.3,afade=t=out:st=${(total - 2.5).toFixed(2)}:d=2.5,volume=-17dB[m];`
const vLabels = [], sLabels = []
cues.forEach(([t, f, g, len], k) => {
  const isVo = f.startsWith('vo/')
  const trim = len ? `atrim=0:${len},afade=t=out:st=${Math.max(0, len - 0.3)}:d=0.3,` : ''
  af += `[${k + 1}:a]aformat=sample_rates=48000:channel_layouts=stereo,${trim}adelay=${Math.round(t * 1000)}|${Math.round(t * 1000)},volume=${g}dB[c${k}];`
  ;(isVo ? vLabels : sLabels).push(`[c${k}]`)
})
af += `${vLabels.join('')}amix=inputs=${vLabels.length}:normalize=0[vo];[vo]asplit=2[vo1][vo2];`
af += `[m][vo2]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[md];`
af += `[md][vo1]${sLabels.join('')}amix=inputs=${2 + sLabels.length}:normalize=0,atrim=0:${total.toFixed(2)},loudnorm=I=-14:TP=-1.2:LRA=9[a]`
ff([...aIn, '-filter_complex', af, '-map', '[a]', '-ar', '48000', '-c:a', 'pcm_s16le', 'build/audio.wav'])
ff(['-i', 'build/video.mp4', '-i', 'build/audio.wav', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', 'build/teampot-demo.mp4'])
console.log(`done: ${total.toFixed(1)}s → build/teampot-demo.mp4`)
