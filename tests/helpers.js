// Node-side helpers: font registry backed by the filesystem.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { FontRegistry, FONT_FAMILIES } from '../js/fonts.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function nodeFonts() {
  const reg = new FontRegistry(async (file) => {
    const buf = await readFile(path.join(ROOT, 'assets/fonts', file));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  });
  for (const fam of Object.keys(FONT_FAMILIES)) {
    await reg.load(fam, 'normal');
    await reg.load(fam, 'bold');
  }
  return reg;
}
