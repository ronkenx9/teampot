import { readFileSync, writeFileSync, existsSync } from "node:fs";
const env = readFileSync(process.env.HOME + "/Documents/vibecoding/lose-the-tail/trailer-workshop/.env", "utf8");
const key = (env.match(/ELEVEN\w*KEY\w*\s*=\s*["']?([^\s"']+)/i) || [])[1];
const list = {
  roll: ["heavy rubber ball rolling across a wooden table, slowing to a stop", 1.4],
  thud: ["soft heavy ball settling thud, small rock", 0.6],
  slash: ["sharp katana sword slash, fruit ninja blade swipe, crisp", 0.6],
  splat: ["juicy fruit slice splat, wet squish, cartoon", 0.6],
  whooshup: ["fast cartoon whoosh flying upward, spinning object", 0.7],
  boing: ["tiny cartoon boing hop, cute, light", 0.5],
  plop: ["cartoon plop into a pot, soft wooden bowl landing", 0.5],
  clank: ["metal pot lid dropping onto a pot, clank and short rattle", 0.8],
  hiss: ["pressure cooker steam hiss building up, getting louder and more intense", 1.7],
  rattle: ["pot lid rattling faster and faster on a boiling pot", 1.3],
  whistle: ["pressure cooker whistle rising to a peak, cartoon", 0.8],
  pop: ["big cartoon cork pop explosion burst, champagne boom, punchy", 0.9],
  fallwhistle: ["cartoon falling whistle, descending pitch, slide whistle down", 1.0],
  scoot: ["quick cartoon scramble skid, tiny feet dash", 0.6],
  catch: ["metal lid landing on a pot clang, bounce and wobble settle", 1.0],
  slideback: ["soft swoosh slide, gentle", 0.6],
  chime: ["soft magical bright chime sparkle, logo reveal, clean", 1.4],
};
for (const [name, [text, duration_seconds]] of Object.entries(list)) {
  if (existsSync(`sfx/${name}.mp3`)) continue;
  const r = await fetch("https://api.elevenlabs.io/v1/sound-generation", { method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify({ text, duration_seconds, prompt_influence: 0.65 }) });
  if (!r.ok) { console.log(name, r.status, (await r.text()).slice(0, 160)); continue; }
  writeFileSync(`sfx/${name}.mp3`, Buffer.from(await r.arrayBuffer())); console.log("ok", name);
}
