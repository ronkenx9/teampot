// Teampot brand board v2: Creatix-style bento (1080x1350), people-first framing, real 3D pot via three.js.
import { readFileSync, writeFileSync } from "node:fs";

const C = { ink: "#141414", paper: "#F6F4F0", clay: "#E8552D", deep: "#B8401C", sand: "#F1E4D8" };
const kit = (f) => readFileSync("kit/" + f, "utf8").replace(/<\?xml[^>]*>/, "");
const sym = (rim, bowl, coin) =>
  `<rect x="24" y="100" width="208" height="32" rx="16" fill="${rim}"/><path fill="${bowl}" d="M56 140 H200 A72 72 0 0 1 56 140 Z"/><circle cx="128" cy="62" r="22" fill="${coin}"/>`;

// construction grid: guides drawn over the black master, like the reference's top-left panel
const LW = +kit("teampot-logo-horizontal-black.svg").match(/viewBox="0 0 (\d+)/)[1];
const construction = `<svg viewBox="-24 -24 ${LW + 48} 304" class="cons">
  <g fill="none" stroke="#141414" stroke-width="1.2">
    <rect x="0" y="40" width="${LW}" height="176"/><line x1="0" y1="102" x2="${LW}" y2="102"/><line x1="0" y1="168" x2="${LW}" y2="168"/>
    <line x1="0" y1="0" x2="0" y2="256"/><line x1="208" y1="0" x2="208" y2="256"/><line x1="252" y1="0" x2="252" y2="256"/><line x1="${LW - 8}" y1="0" x2="${LW - 8}" y2="256"/>
  </g>
  <g fill="#141414"><rect x="-10" y="30" width="20" height="20"/><rect x="${LW - 10}" y="30" width="20" height="20"/><rect x="-10" y="206" width="20" height="20"/><rect x="${LW - 10}" y="206" width="20" height="20"/></g>
  
  ${kit("teampot-logo-horizontal-black.svg").replace(/^<svg[^>]*>/, "<g>").replace(/<\/svg>\s*$/, "</g>").replace(/<title>.*?<\/title>/, "")}
</svg>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Teampot — Brand Board</title>
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,400;0,500;0,600;1,800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0}
body{width:1080px;height:1350px;background:linear-gradient(160deg,#F6E7DC,#EBD3C3);font-family:"Inter Tight",sans-serif;padding:28px;color:${C.ink}}
.g{display:grid;grid-template-columns:repeat(12,1fr);grid-template-rows:470px 450px 330px;gap:22px;height:100%}
.p{border-radius:26px;overflow:hidden;position:relative;display:flex;align-items:center;justify-content:center}
.w{background:#fff}.k{background:${C.ink};color:#fff}
.grad{background:linear-gradient(120deg,#F58A5F 0%,${C.clay} 50%,${C.deep} 100%)}
.cons{width:84%}
.stack{grid-column:8/13;display:grid;grid-template-rows:1fr 1fr;gap:22px}
.wm svg{width:78%;height:auto}
.icons{display:flex;gap:38px}.icons svg{width:112px;height:112px;border-radius:26px;box-shadow:0 14px 30px rgba(80,20,0,.28)}
#three{grid-column:1/5;background:radial-gradient(110% 90% at 30% 15%,#FF9A70 0%,${C.clay} 38%,#5E1A07 100%)}
#three canvas{width:100%!important;height:100%!important}
.ban{grid-column:5/13;padding:44px 48px;align-items:stretch;justify-content:space-between;flex-direction:column}
.ban .top{display:flex;align-items:center;gap:12px;font-weight:600;font-size:20px}.ban .top svg{width:34px;height:34px}
.ban h1{font-size:62px;line-height:1;font-weight:600;letter-spacing:-.04em;max-width:430px}
.ban h1 em{font-style:italic;font-weight:800;color:${C.clay}}
.ban .sub{font-size:17px;opacity:.65;max-width:380px;line-height:1.4}
.ban .out{position:absolute;right:-70px;bottom:-90px;width:360px;opacity:.9}
.type{grid-column:1/8;padding:36px 40px;flex-direction:column;align-items:stretch;justify-content:space-between}
.type .hd{display:flex;justify-content:space-between;font-size:17px;opacity:.85}.type .hd b{font-size:30px;font-weight:600;opacity:1}
.type .cols{display:flex;gap:70px}.type .aa{font-size:64px;line-height:1.1}.type small{display:block;font-size:12px;opacity:.6;line-height:1.7;letter-spacing:.02em}
.lock{grid-column:8/13}.lock svg{width:84%;height:auto}
</style>
<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
</head><body><div class="g">
<div class="p w" style="grid-column:1/8">${construction}</div>
<div class="stack">
  <div class="p w wm">${kit("teampot-logo-horizontal-color.svg")}</div>
  <div class="p grad"><div class="icons">${kit("teampot-app-icon-light.svg")}${kit("teampot-app-icon-dark.svg")}</div></div>
</div>
<div class="p" id="three"></div>
<div class="p k ban">
  <div class="top"><svg viewBox="0 0 256 256">${sym("#fff", C.clay, "#fff")}</svg>teampot</div>
  <div><h1>Work money, <em>finally fun.</em></h1></div>
  <div class="sub">Pay, perks and team pots for everyone you work with, employees and contractors alike.</div>
  <svg class="out" viewBox="0 0 256 256"><g fill="none" stroke="${C.clay}" stroke-width="2.2">${sym("none", "none", "none").replace(/fill="none"/g, "")}</g></svg>
</div>
<div class="p k type">
  <div class="hd"><b>Inter Tight</b><span>Typography</span></div>
  <div class="cols">
    <div><small>Medium</small><div class="aa" style="font-weight:500">Aa</div><small>ABCDEFGHIJKLMNOPQRSTUVWXYZ<br>abcdefghijklmnopqrstuvwxyz<br>0123456789 $ % @ &amp;</small></div>
    <div><small>ExtraBold Italic</small><div class="aa" style="font-weight:800;font-style:italic">Aa</div><small>ABCDEFGHIJKLMNOPQRSTUVWXYZ<br>abcdefghijklmnopqrstuvwxyz<br>0123456789 $ % @ &amp;</small></div>
  </div>
</div>
<div class="p grad lock">${kit("teampot-logo-horizontal-black.svg")}</div>
</div>
<script>
// 3D T-Pot: clay bowl, ink rim, white coin; studio light; rendered once for the board.
const el = document.getElementById("three"), W = el.clientWidth, H = el.clientHeight;
const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
r.setPixelRatio(2); r.setSize(W, H); r.outputColorSpace = THREE.SRGBColorSpace;
r.toneMapping = THREE.ACESFilmicToneMapping; r.shadowMap.enabled = true; el.appendChild(r.domElement);
const s = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, W / H, 0.1, 100);
cam.position.set(4.6, 4.2, 10.5); cam.lookAt(0, 0.35, 0);
s.add(new THREE.HemisphereLight(0xfff1e8, 0x401000, 1.1));
const key = new THREE.DirectionalLight(0xffffff, 2.6); key.position.set(4, 6, 5); key.castShadow = true; s.add(key);
const rim = new THREE.DirectionalLight(0xffb08a, 1.6); rim.position.set(-5, 2, -4); s.add(rim);
const mat = (c, rough, metal = 0) => new THREE.MeshPhysicalMaterial({ color: c, roughness: rough, metalness: metal, clearcoat: 0.8, clearcoatRoughness: 0.15 });
const g = new THREE.Group();
const bowl = new THREE.Mesh(new THREE.SphereGeometry(1.15, 96, 64, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(0xE8552D, 0.35));
bowl.material.side = THREE.DoubleSide; bowl.castShadow = true; g.add(bowl);
const lip = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 0.34, 96), mat(0x141414, 0.3));
lip.position.y = 0.3; g.add(lip);
const edge = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.17, 32, 128), mat(0x141414, 0.3)); edge.rotation.x = Math.PI / 2; edge.position.y = 0.3; g.add(edge);
const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.1, 64), mat(0xffffff, 0.2, 0.1));
coin.position.set(0.1, 1.55, 0.2); coin.rotation.set(Math.PI / 2, 0.5, 0.25); g.add(coin);
g.rotation.set(0.12, -0.5, 0.05); s.add(g);
r.render(s, cam); document.title = "rendered";
</script>
</body></html>`;
writeFileSync("kit/board-v2.html", html);
console.log("ok");
