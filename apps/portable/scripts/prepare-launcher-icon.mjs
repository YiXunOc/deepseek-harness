/** Create the Portable launcher icon from the Desktop executable's application icon. */
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { packIco } from '../../desktop/scripts/render-tray-icon.ts'

const sharp = createRequire(new URL('../../desktop/package.json', import.meta.url))('sharp')
const image = await readFile(new URL('../../desktop/resources/icon-windows.png', import.meta.url))
const sizes = [16, 24, 32, 48, 64, 128, 256]
const entries = await Promise.all(sizes.map(async size => ({
  size,
  png: await sharp(image).resize(size, size).png().toBuffer(),
})))
await writeFile(process.argv[2], packIco(entries))
