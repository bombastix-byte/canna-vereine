// Rendert die PWA-App-Icons aus public/icon.svg in die noetigen PNG-Groessen.
// Einmalig bzw. bei Icon-Aenderung ausfuehren: node scripts/render-icons.mjs
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const svg = readFileSync('public/icon.svg');
const groessen = [
  ['public/icon-192.png', 192],
  ['public/icon-512.png', 512],
  ['public/icon-180.png', 180], // apple-touch-icon
];
for (const [pfad, px] of groessen) {
  await sharp(svg, { density: 384 }).resize(px, px).png().toFile(pfad);
  console.log('gerendert:', pfad);
}
console.log('Fertig.');
