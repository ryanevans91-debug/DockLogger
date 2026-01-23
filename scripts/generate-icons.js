import sharp from 'sharp';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');

async function generateIcons() {
  console.log('Generating app icons...');

  // Read the SVG files
  const iconOnlySvg = readFileSync(join(root, 'assets', 'icon-only.svg'));

  // Generate icon.png (1024x1024) - main icon with background
  await sharp(iconOnlySvg)
    .resize(1024, 1024)
    .png()
    .toFile(join(root, 'resources', 'icon.png'));
  console.log('Created resources/icon.png');

  // Generate icon-only.png (1024x1024) - foreground only for adaptive icons
  await sharp(iconOnlySvg)
    .resize(1024, 1024)
    .png()
    .toFile(join(root, 'resources', 'icon-only.png'));
  console.log('Created resources/icon-only.png');

  // Generate icon-background.png (1024x1024) - solid blue background
  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 37, g: 99, b: 235, alpha: 1 } // #2563eb
    }
  })
    .png()
    .toFile(join(root, 'resources', 'icon-background.png'));
  console.log('Created resources/icon-background.png');

  console.log('\nIcon generation complete!');
}

generateIcons().catch(console.error);
