// Films a clip source page (clips/<name>/index.html) into video.
//   node clips/render.mjs <name> landscape|portrait            full render: <name>/<name>-<format>.mp4, .webm and poster .jpg
//   node clips/render.mjs <name> landscape|portrait 2.5 7 10   stills only, into clips/<name>/build/
// Needs: Node, the "playwright" package, Chrome, ffmpeg. Set CHROME to the browser path if it is not /usr/bin/google-chrome.
import { createRequire } from "node:module";
import { spawn, execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("/opt/node22/lib/node_modules/playwright")); }
const here = dirname(fileURLToPath(import.meta.url));
const name = process.argv[2], format = process.argv[3] || "landscape", stills = process.argv.slice(4).map(Number);
const dir = join(here, name), [W, H] = format === "portrait" ? [1080, 1350] : [1600, 900], FPS = 30;
const browser = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--allow-file-access-from-files", "--font-render-hinting=none"] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.goto("file://" + join(dir, "index.html") + "?capture=1&format=" + format);
await page.waitForFunction("window.READY === true");
const shot = async t => { await page.evaluate(x => window.seek(x), t); return page.screenshot({ type: "jpeg", quality: 92 }); };
if (stills.length) {
  mkdirSync(join(dir, "build"), { recursive: true });
  for (const t of stills) writeFileSync(join(dir, "build", `${format}-${t.toFixed(2)}.jpg`), await shot(t));
} else {
  const end = await page.evaluate("window.END"), base = join(dir, `${name}-${format}`), [w, h] = format === "portrait" ? [864, 1080] : [1280, 720];
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
    "-vf", `scale=${w}:${h}`, "-c:v", "libx264", "-crf", "23", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", base + ".mp4"], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((ok, bad) => ff.on("exit", c => (c === 0 ? ok() : bad(new Error("ffmpeg exit " + c)))));
  for (let f = 0; f < Math.round(end * FPS); f++) { const buf = await shot(f / FPS); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once("drain", r)); }
  ff.stdin.end(); await done;
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", base + ".mp4", "-c:v", "libvpx-vp9", "-crf", "34", "-b:v", "0", "-an", base + ".webm"]);
  writeFileSync(base + "-poster-raw.jpg", await shot(Number(process.env.POSTER || 10.4)));
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", base + "-poster-raw.jpg", "-vf", `scale=${w}:${h}`, "-q:v", "4", base + "-poster.jpg"]);
  execFileSync("rm", [base + "-poster-raw.jpg"]);
}
await browser.close();
