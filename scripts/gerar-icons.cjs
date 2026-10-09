// A marca vetorial é a fonte; os PNG servem o PWA e os ícones do Next.
const fs = require("node:fs");
const sharp = require("sharp");

async function main() {
  const svg = fs.readFileSync("public/marca.svg", "utf8");
  const mask = svg.replace('rx="16"', 'rx="0"');
  for (const [file, size, source] of [
    ["public/icons/icon-192.png", 192, svg],
    ["public/icons/icon-512.png", 512, svg],
    ["public/icons/icon-maskable-512.png", 512, mask],
    ["src/app/icon.png", 512, svg],
    ["src/app/apple-icon.png", 180, mask],
  ]) {
    await sharp(Buffer.from(source)).resize(size, size).png().toFile(file);
  }
  console.log("Ícones gerados a partir de public/marca.svg.");
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
