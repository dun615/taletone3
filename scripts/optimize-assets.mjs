// One-off asset optimizers that need dev dependencies (npm install first).
//
//   node scripts/optimize-assets.mjs webp [--max=1600] <image> [...]
//     Writes a .webp next to each JPEG/PNG (no wider than --max) for the data files to point at.
//
//   node scripts/optimize-assets.mjs variant --width=320 <image> [...]
//     Writes <name>-w320.webp next to each image: a smaller copy for thumbnails (a work's `thumb`,
//     a news item's `cardImage`).
//
//   node scripts/optimize-assets.mjs og <image> [...]
//     Writes <name>-og.jpg next to each image: a 1200x630 JPEG share image (the art centred on a
//     blurred copy of itself) for a work's or news item's `ogImage`. JPEG because some chat apps
//     do not preview WebP.

const [command, ...rest] = process.argv.slice(2);
const option = (name, fallback) => Number(rest.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1] || fallback);
const args = rest.filter((arg) => !arg.startsWith('--'));
const stem = (file) => file.replace(/\.(jpe?g|png|webp)$/i, '');

if (command === 'webp') {
  const { default: sharp } = await import('sharp');
  const maxWidth = option('max', 1600);
  for (const file of args) {
    const out = file.replace(/\.(jpe?g|png)$/i, '.webp');
    if (out === file) throw new Error(`${file}: not a JPEG/PNG`);
    const info = await sharp(file).resize({ width: maxWidth, withoutEnlargement: true }).webp({ quality: 82 }).toFile(out);
    console.log(`${out}: ${info.width}x${info.height} ${info.size} bytes`);
  }
} else if (command === 'variant') {
  const { default: sharp } = await import('sharp');
  const width = option('width', 320);
  for (const file of args) {
    const out = `${stem(file)}-w${width}.webp`;
    const info = await sharp(file).resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toFile(out);
    console.log(`${out}: ${info.width}x${info.height} ${info.size} bytes`);
  }
} else if (command === 'og') {
  const { default: sharp } = await import('sharp');
  for (const file of args) {
    const out = `${stem(file)}-og.jpg`;
    const backdrop = await sharp(file).resize(1200, 630, { fit: 'cover' }).blur(28).modulate({ brightness: 0.7 }).toBuffer();
    const art = await sharp(file).resize(630, 630, { fit: 'inside' }).toBuffer();
    const info = await sharp(backdrop).composite([{ input: art, gravity: 'center' }]).jpeg({ quality: 84, mozjpeg: true }).toFile(out);
    console.log(`${out}: ${info.width}x${info.height} ${info.size} bytes`);
  }
} else {
  console.error('usage: node scripts/optimize-assets.mjs webp|variant|og <image...>');
  process.exit(1);
}
