// Films hero/index.html into video. Usage:
//   node hero/render.mjs landscape|portrait [outDir]        full render, one file per scene, then joined
//   node hero/render.mjs landscape|portrait outDir 3.5 11.9 stills only, at the given times
// Needs: Node, the "playwright" package, Chrome, ffmpeg. Set CHROME to the browser path if it is not /usr/bin/google-chrome.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { renameSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("/opt/node22/lib/node_modules/playwright")); }

const here = dirname(fileURLToPath(import.meta.url));
const format = process.argv[2] || "landscape";
const out = resolve(process.argv[3] || join(here, "build"));
const stills = process.argv.slice(4).map(Number);
const [W, H] = format === "portrait" ? [1080, 1350] : [1920, 1080];
const FPS = 30;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--allow-file-access-from-files", "--font-render-hinting=none"] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.goto("file://" + join(here, "index.html") + "?capture=1&format=" + format);
await page.waitForFunction("window.READY === true");
const shot = async t => { await page.evaluate(x => window.seek(x), t); return page.screenshot({ type: "jpeg", quality: 92 }); };

if (stills.length) {
  for (const t of stills) writeFileSync(join(out, `${format}-${t.toFixed(2)}.jpg`), await shot(t));
} else {
  const scenes = await page.evaluate("window.SCENES");
  const files = [];
  for (let s = 0; s < scenes.length - 1; s++) {
    const f0 = Math.round(scenes[s] * FPS), f1 = Math.round(scenes[s + 1] * FPS) + (s === scenes.length - 2 ? 1 : 0);
    const tmp = join(out, `${format}-scene${s}.tmp.mp4`), fin = join(out, `${format}-scene${s}.mp4`);
    const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
      "-c:v", "libx264", "-crf", "12", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-r", String(FPS), tmp], { stdio: ["pipe", "inherit", "inherit"] });
    const done = new Promise((ok, bad) => ff.on("exit", c => (c === 0 ? ok() : bad(new Error("ffmpeg exit " + c)))));
    for (let f = f0; f < f1; f++) { const buf = await shot(f / FPS); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once("drain", r)); }
    ff.stdin.end(); await done; renameSync(tmp, fin); files.push(fin);
    console.log(format, "scene", s, "frames", f1 - f0);
  }
  writeFileSync(join(out, `${format}-list.txt`), files.map(f => `file '${f}'`).join("\n") + "\n");
  const poster = await shot(scenes[scenes.length - 1]);
  writeFileSync(join(out, `${format}-poster-raw.jpg`), poster);
}
await browser.close();
