/** Build-only Windows Electron acquisition; Linux/Wine test path, not Desktop release packaging. */
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { desktopTargetBuildPaths } from '../../desktop/scripts/desktop-build-paths.mjs'

const requireDesktop = createRequire(new URL('../../desktop/package.json', import.meta.url))
const paths = desktopTargetBuildPaths('win-x64')
const electron = join(paths.electron, 'electron.exe')
if (existsSync(paths.electron)) throw new Error('portable cross Electron: fresh target required')
const version = JSON.parse(readFileSync(new URL('../../desktop/node_modules/electron/package.json', import.meta.url), 'utf8')).version
const { downloadArtifact } = await import(requireDesktop.resolve('@electron/get'))
const archive = await downloadArtifact({ version, platform: 'win32', arch: 'x64', artifactName: 'electron', cacheRoot: paths.downloads })
mkdirSync(paths.electron, { recursive: true })
await requireDesktop('extract-zip')(archive, { dir: paths.electron })
if (!existsSync(electron)) throw new Error('portable cross Electron: missing Windows executable')
const probe = spawnSync('wine', [electron, '-e', `if(process.platform!=='win32'||process.arch!=='x64'||process.versions.node==='')process.exit(1)`],
  { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', WINEDEBUG: '-all' }, stdio: 'ignore', timeout: 90_000 })
if (probe.status !== 0 || probe.error) throw new Error(`portable cross Electron: Wine Node probe failed ${String(probe.error ?? probe.status)}`)
console.log('ELECTRON_VERIFIED', version, archive)
