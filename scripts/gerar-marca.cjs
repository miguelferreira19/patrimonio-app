// Geometria original da marca: uma única fonte para SVG, favicons e instalação.
const fs = require('node:fs/promises');
const sharp = require('sharp');
const root = 'public/brand';
const green = '#143f37', aqua = '#86c9b4', paper = '#f7f5ee';
const geometry = 'M12 30L28 14L44 30V50H12ZM22 31V42H34V31Z';
const courtyard = 'M12 30L28 14L44 30V50H12ZM22 31V42H34V31ZM26 42V50H30V42Z';
const paths = [courtyard, 'M12 30L24 18L36 30V50H12ZM30 26L42 14L54 26V50H36V30ZM22 38V50H28V38ZM42 32V40H48V32Z', 'M12 30L32 12L52 30V52H12ZM22 32V42H42V32ZM29 42V52H35V42Z'];
function symbol(color = paper, small = false, index = 0) { return `<path fill="${color}" fill-rule="evenodd" d="${index === 0 ? small ? geometry : courtyard : paths[index]}"/>${index === 0 ? `<path fill="${color === 'currentColor' ? color : aqua}" d="M44 34H52V50H44Z"/>` : ''}`; }
function svg(content, width = 64, height = 64, view = '0 0 64 64') { return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${view}">${content}</svg>`; }
const tile = (small = false, index = 0) => svg(`<rect width="64" height="64" rx="14" fill="${green}"/>${symbol(paper, small, index)}`);
async function write(name, body) { await fs.writeFile(`${root}/${name}`, body); }
async function main() {
  await fs.mkdir(root, { recursive: true });
  await Promise.all([write('symbol-on-dark.svg', svg(symbol())), write('symbol-on-light.svg', svg(symbol(green))), write('symbol-mono.svg', svg(symbol('currentColor', true))), write('symbol-small.svg', svg(symbol(green, true))), write('app-icon.svg', tile()), write('app-icon-small.svg', tile(true)), fs.writeFile('public/marca.svg', tile())]);
  for (let i = 0; i < 3; i++) await write(`proposta-${i + 1}.svg`, tile(false, i));
  await write('lockup-light.svg', svg(`<g transform="translate(0 0)">${symbol(green)}</g><text x="76" y="40" font-family="Inter,Arial,sans-serif" font-size="30" font-weight="600" letter-spacing="-.5" fill="${green}">Património</text>`, 250, 64, '0 0 250 64'));
  await write('lockup-dark.svg', svg(`${symbol()}<text x="76" y="40" font-family="Inter,Arial,sans-serif" font-size="30" font-weight="600" letter-spacing="-.5" fill="${paper}">Património</text>`, 250, 64, '0 0 250 64'));
  const names = ['Casa com pátio', 'Casas em conjunto', 'Casa de pátio central'];
  let board = `<rect width="1200" height="680" fill="${paper}"/><text x="48" y=" sixty"/>`.replace('<text x="48" y=" sixty"/>', `<text x="48" y="64" font-size="30" font-weight="600" fill="${green}">Património · estudos do símbolo</text><text x="48" y="98" font-size="16" fill="${green}">Geometria original, pátio em espaço negativo e volumes de uma casa.</text>`);
  for (let i = 0; i < 3; i++) { const x = 48 + i * 385;
    board += `<g transform="translate(${x} 150)"><rect width="350" height="440" rx="16" fill="#fffdf7"/><text x="24" y="38" font-size="20" font-weight="600" fill="${green}">${names[i]}</text><g transform="translate(94 78) scale(2.5)"><rect width="64" height="64" rx="14" fill="${green}"/>${symbol(paper, false, i)}</g><text x="24" y="286" font-size="14" fill="${green}">Tamanhos reais</text><g transform="translate(28 312) scale(.25)"><rect width="64" height="64" rx="14" fill="${green}"/>${symbol(paper, i === 0, i)}</g><text x="54" y="326" font-size="13" fill="${green}">16 px</text><g transform="translate(155 304) scale(.5)"><rect width="64" height="64" rx="14" fill="${green}"/>${symbol(paper, i === 0, i)}</g><text x="201" y="326" font-size="13" fill="${green}">32 px</text><text x="24" y="385" font-size="14" fill="${green}">${i === 0 ? 'Casa, pátio e volume lateral em verde-água.' : i === 1 ? 'Dois telhados; conjunto de imóveis.' : 'Pátio largo; desenho mais simétrico.'}</text></g>`;
  }
  board += `<text x="48" y="636" font-size="15" fill="${green}">Escolha: Casa com pátio. Silhueta assimétrica própria; entrada simplificada a 16 e 32 px.</text>`;
  const boardSvg = svg(`<g font-family="Arial,sans-serif">${board}</g>`, 1200, 680, '0 0 1200 680');
  await write('comparacao.svg', boardSvg); await sharp(Buffer.from(boardSvg)).png().toFile(`${root}/comparacao.png`);
  const final = svg(`<rect width="1100" height="430" fill="${green}"/><g transform="translate(48 40) scale(3)">${symbol()}</g><text x="284" y="145" fill="${paper}" font-family="Arial,sans-serif" font-size="58" font-weight="600">Património</text><text x="286" y="186" fill="${aqua}" font-family="Arial,sans-serif" font-size="18">Casa, pátio e uma nova ala. Uma marca para cuidar do património.</text><rect x="48" y="280" width="1004" height="110" rx="16" fill="${paper}"/><g transform="translate(72 300)">${symbol(green)}</g><g transform="translate(210 300)">${symbol(green, true)}</g><g transform="translate(350 312) scale(.5)"><rect width="64" height="64" rx="14" fill="${green}"/>${symbol(paper, true)}</g><g transform="translate(450 320) scale(.25)"><rect width="64" height="64" rx="14" fill="${green}"/>${symbol(paper, true)}</g><text x="580" y="342" font-family="Arial,sans-serif" font-size="20" fill="${green}">Claro · monocromático · 32 px · 16 px</text>`, 1100, 430, '0 0 1100 430');
  await write('identidade.svg', final); await sharp(Buffer.from(final)).png().toFile(`${root}/identidade.png`);
  const image = Buffer.from(tile()); const small = Buffer.from(tile(true));
  for (const [path, size] of [['public/icons/icon-192.png',192],['public/icons/icon-512.png',512],['src/app/icon.png',512],['src/app/apple-icon.png',180]]) await sharp(image).resize(size,size).png().toFile(path);
  await sharp(Buffer.from(svg(`<rect width="64" height="64" fill="${green}"/>${symbol()}`))).resize(512,512).png().toFile('public/icons/icon-maskable-512.png');
  const sizes = [16,32,48]; const buffers = await Promise.all(sizes.map((size) => sharp(small).resize(size,size).png().toBuffer()));
  const header = Buffer.alloc(6 + 16 * sizes.length); header.writeUInt16LE(1,2); header.writeUInt16LE(sizes.length,4); let offset = header.length;
  sizes.forEach((size,i) => { const p = 6+i*16; header[p]=size; header[p+1]=size; header.writeUInt16LE(1,p+4); header.writeUInt16LE(32,p+6); header.writeUInt32LE(buffers[i].length,p+8); header.writeUInt32LE(offset,p+12); offset+=buffers[i].length; });
  await fs.writeFile('src/app/favicon.ico', Buffer.concat([header,...buffers]));
  console.log('Marca, três propostas, variantes, favicon e ícones gerados.');
}
main().catch((e) => { console.error(e.message); process.exit(1); });
