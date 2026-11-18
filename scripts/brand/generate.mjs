// Generates the massage-desk brand set (logo F — "massage stones") as SVG + PNG.
// Usage (from the repo root): npm run brand
//   writes sources + PNGs to assets/brand/ and the app icons to apps/mobile/assets/
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const out = path.join(root, "assets/brand");
const mobileAssets = path.join(root, "apps/mobile/assets");
mkdirSync(out, { recursive: true });

const DEFS = `<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FAF6EF"/><stop offset="1" stop-color="#ECE0CE"/></linearGradient>
<linearGradient id="s1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1E8A72"/><stop offset="1" stop-color="#0E4F45"/></linearGradient>
<linearGradient id="s2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34A88C"/><stop offset="1" stop-color="#1F6F5C"/></linearGradient>
<linearGradient id="s3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7FD6BE"/><stop offset="1" stop-color="#46B095"/></linearGradient>
<linearGradient id="dot" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFB25B"/><stop offset="1" stop-color="#F0603C"/></linearGradient>
<linearGradient id="dark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14362F"/><stop offset="1" stop-color="#0D221E"/></linearGradient>
</defs>`;
const MARK = `<ellipse cx="512" cy="742" rx="292" ry="104" fill="url(#s1)"/>
<ellipse cx="512" cy="566" rx="214" ry="86" fill="url(#s2)"/>
<ellipse cx="512" cy="414" rx="140" ry="64" fill="url(#s3)"/>
<circle cx="512" cy="282" r="58" fill="url(#dot)"/>`;
const MONO = `<ellipse cx="512" cy="742" rx="292" ry="104"/><ellipse cx="512" cy="566" rx="214" ry="86"/><ellipse cx="512" cy="414" rx="140" ry="64"/><circle cx="512" cy="282" r="58"/>`;
const svg = (vb, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${DEFS}${body}</svg>\n`;
const SQ = "0 0 1024 1024";
const icon = `<rect width="1024" height="1024" rx="232" fill="url(#bg)"/><g transform="translate(0,-10)">${MARK}</g>`;
const safe = (inner) => `<g transform="translate(512,512) scale(0.68) translate(-512,-522)">${inner}</g>`;
const FONT = `font-family="Inter, 'SF Pro Display', Helvetica, Arial, sans-serif"`;

// README header: what the product does, with a WhatsApp exchange and the master's "Today" screen.
const chip = (x, w, label) =>
  `<rect x="${x}" y="480" width="${w}" height="48" rx="24" fill="#FFFFFF" stroke="#E6DCCB" stroke-width="1.5"/>` +
  `<text x="${x + w / 2}" y="511" ${FONT} font-weight="600" font-size="20" fill="#14332E" text-anchor="middle">${label}</text>`;
const visit = (y, time, label) =>
  `<rect x="872" y="${y}" width="276" height="70" rx="16" fill="#FAF6EF"/>` +
  `<text x="890" y="${y + 43}" ${FONT} font-weight="700" font-size="22" fill="#1F6F5C">${time}</text>` +
  `<text x="966" y="${y + 42}" ${FONT} font-weight="500" font-size="18" fill="#14332E">${label}</text>`;
const README_BANNER = `<rect width="1280" height="640" fill="#FAF6EF"/>
<circle cx="1060" cy="120" r="340" fill="#DDF0E9" opacity="0.6"/>
<g transform="translate(80,80) scale(0.0703)">${icon}</g>
<text x="172" y="130" ${FONT} font-weight="700" font-size="40" fill="#14332E" letter-spacing="-0.8">massage<tspan dx="11" fill="#1F8A72" font-weight="500">desk</tspan></text>
<text ${FONT} font-weight="700" font-size="56" fill="#14332E" letter-spacing="-1.1"><tspan x="80" y="250">Bookings that</tspan><tspan x="80" y="322">answer themselves.</tspan></text>
<text ${FONT} font-weight="500" font-size="26" fill="#4F615B"><tspan x="80" y="390">An AI assistant books clients in WhatsApp.</tspan><tspan x="80" y="426">The master sees the day in an Android app.</tspan></text>
${chip(80, 200, "WhatsApp AI bot")}${chip(292, 160, "Android app")}${chip(464, 160, "Admin panel")}
<rect x="840" y="60" width="340" height="520" rx="44" fill="#14332E"/>
<rect x="852" y="72" width="316" height="496" rx="34" fill="#FFFFFF"/>
<text x="876" y="124" ${FONT} font-weight="700" font-size="30" fill="#14332E">Today</text>
<text x="1144" y="122" ${FONT} font-weight="500" font-size="18" fill="#4F615B" text-anchor="end">3 visits</text>
${visit(148, "10:00", "Back · 60 min")}${visit(230, "13:30", "Full body · 90 min")}
<rect x="872" y="312" width="276" height="96" rx="16" fill="#FDE3D6" stroke="#F0603C" stroke-width="1.5"/>
<text x="890" y="350" ${FONT} font-weight="700" font-size="22" fill="#8A2E12">16:00</text>
<text x="966" y="349" ${FONT} font-weight="500" font-size="18" fill="#14332E">Neck · 30 min</text>
<text x="890" y="385" ${FONT} font-weight="700" font-size="16" fill="#8A2E12">Asks to reschedule</text>
<rect x="872" y="484" width="276" height="60" rx="16" fill="#1F6F5C"/>
<text x="1010" y="521" ${FONT} font-weight="600" font-size="20" fill="#FFFFFF" text-anchor="middle">New booking</text>
<path d="M658 330 H852 a18 18 0 0 1 18 18 V364 a18 18 0 0 1 -18 18 H644 a4 4 0 0 1 -4 -4 V348 a18 18 0 0 1 18 -18 Z" fill="#FFFFFF" stroke="#E6DCCB" stroke-width="1.5"/>
<text x="658" y="362" ${FONT} font-weight="500" font-size="17" fill="#14332E">Tomorrow at 6 free?</text>
<path d="M658 396 H852 a18 18 0 0 1 18 18 V472 a4 4 0 0 1 -4 4 H658 a18 18 0 0 1 -18 -18 V414 a18 18 0 0 1 18 -18 Z" fill="#DDF0E9"/>
<text ${FONT} font-weight="600" font-size="17" fill="#155445"><tspan x="658" y="429">18:00 is free.</tspan><tspan x="658" y="455">Shall I book it?</tspan></text>`;

const files = {
  "logo.svg": [svg(SQ, icon), 1024, 1024, "icon.png"],
  "mark.svg": [svg(SQ, `<g transform="translate(0,-10)">${MARK}</g>`), 1024, 1024, "splash-icon.png"],
  "mark-mono.svg": [svg(SQ, `<g fill="#14332E" transform="translate(0,-10)">${MONO}</g>`), 512, 512, "mark-mono.png"],
  "android-icon-foreground.svg": [svg(SQ, safe(MARK)), 1024, 1024, "android-icon-foreground.png"],
  "android-icon-background.svg": [svg(SQ, `<rect width="1024" height="1024" fill="url(#bg)"/>`), 1024, 1024, "android-icon-background.png"],
  "android-icon-monochrome.svg": [svg(SQ, `<g fill="#000000">${safe(MONO)}</g>`), 1024, 1024, "android-icon-monochrome.png"],
  "logo-horizontal.svg": [svg("0 0 1640 360",
    `<g transform="scale(0.3515)">${icon}</g><text x="420" y="222" ${FONT} font-weight="700" font-size="150" fill="#14332E" letter-spacing="-3">massage<tspan fill="#1F8A72" font-weight="500"> desk</tspan></text>`), 1640, 360, "logo-horizontal.png"],
  "logo-horizontal-dark.svg": [svg("0 0 1640 360",
    `<g transform="scale(0.3515)">${icon}</g><text x="420" y="222" ${FONT} font-weight="700" font-size="150" fill="#FAF6EF" letter-spacing="-3">massage<tspan fill="#7FD6BE" font-weight="500"> desk</tspan></text>`), 1640, 360, "logo-horizontal-dark.png"],
  "social-preview.svg": [svg("0 0 1280 640",
    `<rect width="1280" height="640" fill="url(#dark)"/><g transform="translate(110,170) scale(0.293)">${icon}</g>
<text x="470" y="300" ${FONT} font-weight="700" font-size="92" fill="#FAF6EF">massage desk</text>
<text x="474" y="368" ${FONT} font-weight="500" font-size="34" fill="#9FDCCB">WhatsApp booking bot + app for the master</text>
<text x="474" y="418" ${FONT} font-weight="500" font-size="34" fill="#7FB3A6">Spring Boot · Expo · Supabase · AI assistant</text>`), 1280, 640, "social-preview.png"],
  "readme-banner.svg": [svg("0 0 1280 640", README_BANNER), 1280, 640, "readme-banner.png"],
};

for (const [name, [content, w, h, png]] of Object.entries(files)) {
  writeFileSync(path.join(out, name), content);
  await sharp(Buffer.from(content)).resize(w, h).png({ compressionLevel: 9 }).toFile(path.join(out, png));
}
await sharp(Buffer.from(files["logo.svg"][0])).resize(48, 48).png().toFile(path.join(out, "favicon.png"));

for (const f of [
  "icon.png",
  "splash-icon.png",
  "favicon.png",
  "android-icon-foreground.png",
  "android-icon-background.png",
  "android-icon-monochrome.png",
]) {
  copyFileSync(path.join(out, f), path.join(mobileAssets, f));
}
console.log("brand generated:", Object.keys(files).length * 2 + 1, "files; app icons updated");
