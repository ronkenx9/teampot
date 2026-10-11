// Builds the soundtrack: music bed + every sound cue from film.html (out/cues.json), loudness-normalised.
// Usage: node audio.mjs [bgm.mp3] [out.wav]
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
const SFX = 'assets/sfx'
const bgm = process.argv[2] || 'assets/bgm-recall.mp3'
const out = process.argv[3] || 'out/mix.wav'
const meta = JSON.parse(readFileSync('out/cues.json', 'utf8'))
const DUR = meta.dur
const cues = meta.cues
const files = [...new Set(cues.map((c) => c[1]))]
const args = ['-y', '-i', bgm]
for (const f of files) args.push('-i', `${SFX}/${f}.wav`)
// each cue: split its source, delay to its time, set its gain
const counts = Object.fromEntries(files.map((f) => [f, cues.filter((c) => c[1] === f).length]))
const parts = []
files.forEach((f, i) => { const n = counts[f]; parts.push(`[${i + 1}:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit=${n}${Array.from({ length: n }, (_, k) => `[s${i}_${k}]`).join('')}`) })
const used = Object.fromEntries(files.map((f) => [f, 0]))
const labels = []
cues.forEach(([t, f, db, len], j) => {
  const i = files.indexOf(f), k = used[f]++
  const ms = Math.round(t * 1000)
  const trim = len ? `atrim=0:${len},afade=t=out:st=${Math.max(0, len - 0.35)}:d=0.35,` : ''
  parts.push(`[s${i}_${k}]${trim}adelay=${ms}|${ms},volume=${db}dB[c${j}]`)
  labels.push(`[c${j}]`)
})
// music: trim to length, gentle fades, sit under the effects
parts.push(`[0:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:${DUR},afade=t=in:st=0:d=0.4,afade=t=out:st=${DUR - 3.2}:d=3.2,volume=-3dB[m]`)
parts.push(`[m]${labels.join('')}amix=inputs=${labels.length + 1}:normalize=0:dropout_transition=0,atrim=0:${DUR},loudnorm=I=-14:TP=-1.2:LRA=9[out]`)
args.push('-filter_complex', parts.join(';'), '-map', '[out]', '-ar', '48000', '-c:a', 'pcm_s16le', out)
execFileSync('ffmpeg', args, { stdio: ['ignore', 'ignore', 'inherit'] })
console.log(`mixed ${cues.length} cues over ${bgm} → ${out}`)
