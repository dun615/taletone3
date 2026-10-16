// One-off asset optimizers that need dev dependencies (npm install first).
//
//   node scripts/optimize-assets.mjs webp [--max=1600] <image> [...]
//     Writes a .webp next to each JPEG/PNG (no wider than --max) for the data files to point at.

const [command, ...rest] = process.argv.slice(2);
const maxWidth = Number(rest.find((arg) => arg.startsWith('--max='))?.slice(6) || 1600);
const args = rest.filter((arg) => !arg.startsWith('--'));

if (command === 'webp') {
  const { default: sharp } = await import('sharp');
  for (const file of args) {
    const out = file.replace(/\.(jpe?g|png)$/i, '.webp');
    if (out === file) throw new Error(`${file}: not a JPEG/PNG`);
    const info = await sharp(file).resize({ width: maxWidth, withoutEnlargement: true }).webp({ quality: 82 }).toFile(out);
    console.log(`${out}: ${info.width}x${info.height} ${info.size} bytes`);
  }
} else {
  console.error('usage: node scripts/optimize-assets.mjs webp <image...>');
  process.exit(1);
}
