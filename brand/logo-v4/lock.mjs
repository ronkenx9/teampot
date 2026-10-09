// Teampot locked mark (pot with lifted lid), traced from the chosen image-gen symbol. Builds the master SVG set.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
const opentype = createRequire(import.meta.url)('../node_modules/opentype.js')

const C = { ink: '#141414', clay: '#E8552D', paper: '#F6F4F0', white: '#FFFFFF' }
// Geometric master (redrawn over the potrace trace of the chosen image-gen symbol; overlay verified).
const BOWL = 'M58 302 C100 470 240 615 400 615 C560 615 698 470 743 302 C746 292 738 290 731 293 C620 345 510 376 400 376 C290 376 180 345 69 293 C62 290 55 293 58 302 Z'
const LID = 'M98 207 C220 246 330 252 420 250 C540 247 630 221 690 188 C714 176 724 196 709 216 C640 285 530 318 410 318 C290 318 170 287 99 240 C84 230 86 203 98 207 Z'
const S = 800 // square artboard
const CONTENT = { x: 55, y: 176, w: 692, h: 440 } // tight bounds of bowl + lid
const mark = (bowl, lid) => `<g transform="translate(0 4)"><path fill="${bowl}" d="${BOWL}"/><path fill="${lid}" d="${LID}"/></g>`
const svg = (vb, w, h, body, title) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w}" height="${h}" role="img"><title>${title}</title>${body}</svg>\n`

const font = opentype.parse(readFileSync('../node_modules/@fontsource/inter-tight/files/inter-tight-latin-800-italic.woff').buffer)
function word(size, fill, lidFill) {
  let x = 0, maxX = 0; const out = []
  for (const ch of 'teampot') {
    const g = font.charToGlyph(ch), p = g.getPath(x, 0, size)
    maxX = Math.max(maxX, p.getBoundingBox().x2)
    out.push(`<path fill="${ch === 'o' && lidFill ? lidFill : fill}" d="${p.toPathData(1)}"/>`)
    x += g.advanceWidth * (size / font.unitsPerEm) - 0.045 * size
  }
  return { body: out.join(''), width: maxX }
}

function lockup(bowl, lid, text, bg) {
  // Symbol drawn at content height H; wordmark x-height sits on the bowl's band.
  const H = 330, scale = H / CONTENT.h, symW = CONTENT.w * scale, gap = 70
  const wm = word(360, text)
  const W = Math.ceil(symW + gap + wm.width + 20), Ht = 420
  const sym = `<g transform="translate(0 ${(Ht - H) / 2}) scale(${scale}) translate(${-CONTENT.x} ${-CONTENT.y})">${mark(bowl, lid)}</g>`
  const text_ = `<g transform="translate(${symW + gap} ${Ht / 2 + 112})">${wm.body}</g>`
  return svg(`0 0 ${W} ${Ht}`, W, Ht, (bg ? `<rect width="${W}" height="${Ht}" fill="${bg}"/>` : '') + sym + text_, 'Teampot logo')
}
const icon = (bg, bowl, lid) => svg(`0 0 ${S} ${S}`, 1024, 1024, `<rect width="${S}" height="${S}" rx="${S * 0.225}" fill="${bg}"/><g transform="translate(${S * 0.19} ${S * 0.21}) scale(0.62)">${mark(bowl, lid)}</g>`, 'Teampot app icon')

mkdirSync('final', { recursive: true })
const files = {
  'teampot-symbol.svg': svg(`0 0 ${S} ${S}`, 512, 512, mark(C.ink, C.clay), 'Teampot symbol'),
  'teampot-symbol-black.svg': svg(`0 0 ${S} ${S}`, 512, 512, mark(C.ink, C.ink), 'Teampot symbol black'),
  'teampot-symbol-white.svg': svg(`0 0 ${S} ${S}`, 512, 512, mark(C.white, C.white), 'Teampot symbol white'),
  'teampot-symbol-reversed.svg': svg(`0 0 ${S} ${S}`, 512, 512, mark(C.white, C.clay), 'Teampot symbol reversed'),
  'teampot-logo.svg': lockup(C.ink, C.clay, C.ink),
  'teampot-logo-black.svg': lockup(C.ink, C.ink, C.ink),
  'teampot-logo-reversed.svg': lockup(C.white, C.clay, C.white),
  'teampot-app-icon.svg': icon(C.ink, C.white, C.clay),
  'teampot-app-icon-light.svg': icon(C.paper, C.ink, C.clay),
  'teampot-app-icon-clay.svg': icon(C.clay, C.white, C.ink),
}
for (const [n, s] of Object.entries(files)) writeFileSync('final/' + n, s)
console.log(Object.keys(files).length, 'files')
