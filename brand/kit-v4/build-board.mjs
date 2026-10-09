// Teampot brand board v4: built from the locked logo files and real product screenshots.
import { readFileSync, writeFileSync } from 'node:fs'
const F = '../logo-v4/final/'
const svg = (f, style = '') => readFileSync(F + f, 'utf8').replace(/<\?xml[^>]*>/, '').replace(/<svg /, `<svg style="${style}" `).replace(/ width="\d+" height="\d+"/, '')
const shot = (f) => `data:image/webp;base64,${readFileSync('../../app/web/public/shots/' + f).toString('base64')}`
const fill = (ratio, size = 64, dark = false) => {
  const n = 4, g = size * 0.08, b = (size - g * 3) / n, lit = Math.round(ratio * 16)
  let out = ''
  for (let i = 0; i < 16; i++) { const r = 3 - Math.floor(i / 4), c = i % 4; out += `<rect x="${c * (b + g)}" y="${r * (b + g)}" width="${b}" height="${b}" rx="${b * 0.28}" fill="${i < lit ? '#E8552D' : dark ? '#333' : '#E9E3DA'}"/>` }
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${out}</svg>`
}
const sw = (name, hex, fg, use) => `<div class="sw" style="background:${hex};color:${fg}"><b>${name}</b><span>${hex}</span><small>${use}</small></div>`
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Teampot brand board</title>
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,400;0,500;0,600;1,800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0}body{width:1600px;background:#EDE9E3;font-family:"Inter Tight",sans-serif;color:#141414;padding:40px}
.g{display:grid;grid-template-columns:repeat(12,1fr);gap:20px}.p{background:#fff;border-radius:22px;padding:34px;position:relative;overflow:hidden;min-height:280px}
.lbl{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#8a847c;margin-bottom:22px;display:block}.dark{background:#141414;color:#fff}.dark .lbl{color:#8f8a84}.paper{background:#F6F4F0}.clay{background:#E8552D;color:#fff}.clay .lbl{color:#ffd7c9}
.s12{grid-column:span 12}.s8{grid-column:span 8}.s6{grid-column:span 6}.s4{grid-column:span 4}.s7{grid-column:span 7}.s5{grid-column:span 5}
.center{display:flex;flex-direction:column;justify-content:center}
h1{font-size:96px;font-weight:800;font-style:italic;letter-spacing:-.05em;line-height:.92}
.sub{font-size:22px;color:#6f6a63;margin-top:22px;max-width:760px;line-height:1.35}
.icons{display:flex;gap:28px;align-items:center}.icons svg{width:150px;height:150px;border-radius:34px;box-shadow:0 14px 30px rgba(0,0,0,.14)}
.sws{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.sw{height:190px;border-radius:16px;padding:20px;display:flex;flex-direction:column;justify-content:flex-end;gap:2px;border:1px solid #e4ded6}.sw b{font-size:20px}.sw span{font-size:15px;font-weight:600}.sw small{font-size:13px;opacity:.75}
.type .big{font-size:120px;font-weight:800;font-style:italic;letter-spacing:-.05em;line-height:.9}.type .row{display:flex;gap:48px;margin-top:26px;font-size:15px;color:#6f6a63;line-height:1.6}.type .row b{color:#141414;display:block}
.cs{display:flex;align-items:center;gap:40px}.cs .box{border:1.5px dashed #E8552D;padding:28px;border-radius:6px}
.rules{font-size:15px;line-height:1.7;color:#4a4642}.rules b{color:#141414}
.gauges{display:flex;gap:26px;align-items:flex-end}.gauges figure{display:flex;flex-direction:column;align-items:center;gap:8px;font-size:12px;color:#8a847c;margin:0}
.shots{position:relative;height:560px}.shots img{position:absolute;border-radius:12px;box-shadow:0 20px 50px rgba(0,0,0,.18);border:1px solid #e4ded6}
.foot{grid-column:span 12;display:flex;justify-content:space-between;font-size:13px;color:#8a847c;padding:4px 6px}
</style></head><body><div class="g">
<div class="p s8 paper center"><span class="lbl">Teampot · brand v4</span><h1>Every team runs<br>its own money.</h1><p class="sub">Finance sets the frame. Departments decide. Everyone's paid and spends from their phone, with limits the network enforces.</p></div>
<div class="p s4 clay center"><span class="lbl">Symbol</span>${svg('teampot-symbol.svg', 'width:100%;max-width:300px;height:auto;margin:auto;display:block').replace('#141414', '#FFFFFF').replace('#E8552D', '#141414')}</div>
<div class="p s7 center"><span class="lbl">Primary lockup</span>${svg('teampot-logo.svg', 'width:86%;height:auto')}</div>
<div class="p s5 dark center"><span class="lbl">Reversed</span>${svg('teampot-logo-reversed.svg', 'width:92%;height:auto')}</div>
<div class="p s6"><span class="lbl">App icon</span><div class="icons">${svg('teampot-app-icon.svg')}${svg('teampot-app-icon-light.svg')}${svg('teampot-app-icon-clay.svg')}</div></div>
<div class="p s6"><span class="lbl">Clear space &amp; size</span><div class="cs"><div class="box">${svg('teampot-symbol.svg', 'width:120px;height:120px;display:block')}</div><p class="rules"><b>Clear space:</b> the lid's height on every side.<br><b>Minimum:</b> symbol 16 px · lockup 96 px wide.<br><b>On dark:</b> white bowl, clay lid.<br><b>Never:</b> recolour the lid, stretch, add effects, or redraw.</p></div></div>
<div class="p s12"><span class="lbl">Colour</span><div class="sws">${sw('Clay', '#E8552D', '#fff', 'The lid. Accent and primary actions only')}${sw('Ink', '#141414', '#fff', 'The bowl. Text and dark surfaces')}${sw('Paper', '#F6F4F0', '#141414', 'Backgrounds')}${sw('Clay Deep', '#B8401C', '#fff', 'Small clay text on light (AA)')}</div></div>
<div class="p s7 type"><span class="lbl">Type · Inter Tight</span><div class="big">$3,600</div><div class="row"><div><b>ExtraBold Italic</b>Money, headlines, the wordmark</div><div><b>Medium</b>Section titles</div><div><b>Regular</b>Body and interface</div></div></div>
<div class="p s5"><span class="lbl">Fill gauge · a UI element, not the logo</span><div class="gauges"><figure>${fill(1)}full</figure><figure>${fill(0.62)}mid-month</figure><figure>${fill(0.2)}nearly spent</figure></div><p class="rules" style="margin-top:22px">Lit blocks are the money left in a pot, filling from the bottom. Used on every department and person card.</p></div>
<div class="p s12 paper"><span class="lbl">Product · real screens from the live demo</span><div class="shots"><img src="${shot('finance.webp')}" style="width:72%;left:0;top:0"><img src="${shot('phone.webp')}" style="width:20%;right:4%;top:40px;border-radius:26px;border:7px solid #141414"></div></div>
<div class="foot"><span>Teampot · brand board v4</span><span>teampot.vercel.app · github.com/ronkenx9/teampot</span></div>
</div></body></html>`
writeFileSync('board.html', html)
console.log('board.html written')
