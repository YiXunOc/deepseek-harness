/** Build-only Linux -> Windows runtime assembly; never replaces Desktop's native release path. */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { desktopTargetBuildPaths } from '../../desktop/scripts/desktop-build-paths.mjs'
import { createRuntimeProjectMetadata } from '../../desktop/src/project-manager.ts'
import { parseDesktopRelease } from '../../desktop/src/release.ts'
import { DESKTOP_HOST_PROTOCOL_VERSION } from '../../desktop/src/host-protocol.ts'
import { DESKTOP_HOST_PACKAGE, DESKTOP_HOST_RUNTIME_FILES, verifyDesktopCoreLockfile, verifyDesktopCorePackageSet } from '../../desktop/src/core-package-set.ts'
import { prepareRuntimePatches, verifyRuntimePatches, type PreparedRuntimePatches } from '../../desktop/scripts/prepare-runtime-patches.ts'
import { desktopRuntimeFileExclusion } from '../../desktop/scripts/runtime-file-policy.ts'
import { prepareRuntimeManifests } from '../../desktop/scripts/prepare-runtime-manifests.ts'
import { writeDesktopRuntime, verifyDesktopRuntime } from '../../desktop/src/runtime-tree.ts'
import { selectOfficeEngine } from '../../../scripts/libreoffice-packages.mjs'

const root = resolve(import.meta.dirname, '../../..')
const paths = desktopTargetBuildPaths('win-x64')
const stage = process.env.DSH_PORTABLE_CROSS_STAGE ?? join(paths.root, 'portable-cross-stage')
const output = join(paths.root, 'dsh-verify')
const version: string = JSON.parse(readFileSync(join(root, 'apps/desktop/package.json'), 'utf8')).version
function readPrimary() {
  const primary = JSON.parse(readFileSync(join(paths.runtime, 'primary-runtime/runtime.json'), 'utf8')) as Record<string, unknown>
  if (primary.platform !== 'win32' || primary.arch !== 'x64' || primary.desktopVersion !== version
    || typeof primary.node !== 'string' || typeof primary.pnpm !== 'string') {
    throw new Error('portable cross runtime: Windows primary runtime/version mismatch')
  }
  return primary
}
function readRelease() {
  const primary = readPrimary()
  return parseDesktopRelease({ schemaVersion: 1, version, hostProtocolVersion: DESKTOP_HOST_PROTOCOL_VERSION,
    nodeVersion: primary.node, pnpmVersion: primary.pnpm })
}
const target = { platform: 'win32' as const, arch: 'x64' as const }
const patchRecord = join(stage, 'portable-cross-patches.json')
const requireFile = (file: string): void => { if (!existsSync(file)) throw new Error(`portable cross runtime: missing ${file}`) }

function bootstrap(): void {
  const primary = readPrimary()
  const electron = join(paths.electron, 'electron.exe')
  requireFile(electron)
  const node = join(paths.runtime, 'primary-runtime/dependencies/node/bin/node.exe')
  requireFile(node)
  const cli = join(paths.runtime, 'cli/bin')
  mkdirSync(cli, { recursive: true })
  cpSync(join(root, 'apps/desktop/scripts/node-bin'), join(paths.runtime, 'bin'), { recursive: true })
  cpSync(join(root, 'apps/desktop/cli/dsh.cmd'), join(cli, 'dsh.cmd'))
  cpSync(join(root, 'apps/desktop/lib/command-manager-entry.js'), join(paths.runtime, 'cli/command-manager.js'))
  cpSync(join(root, 'apps/desktop/scripts/command-path.ps1'), join(paths.runtime, 'cli/command-path.ps1'))
  writeFileSync(join(paths.runtime, 'versions.json'), `${JSON.stringify({ schemaVersion: 1, node: primary.node, pnpm: primary.pnpm }, null, 2)}\n`)
  console.log('BOOTSTRAPPED', primary.node, primary.pnpm)
}

async function prepare(): Promise<void> {
  if (existsSync(stage)) throw new Error('portable cross runtime: stage already exists; use a fresh worktree')
  mkdirSync(stage, { recursive: true })
  cpSync(join(paths.packageSet, 'desktop-packages.json'), join(stage, 'desktop-packages.json'))
  cpSync(join(paths.packageSet, 'desktop-packages'), join(stage, 'desktop-packages'), { recursive: true })
  createRuntimeProjectMetadata(stage, readRelease())
  const plan = prepareRuntimePatches(stage, root)
  const workspace = join(stage, 'pnpm-workspace.yaml')
  const text = readFileSync(workspace, 'utf8')
  if (!text.includes('nodeLinker: hoisted') || text.includes('supportedArchitectures:')) throw new Error('portable cross runtime: unexpected stage workspace')
  writeFileSync(workspace, `${text}
supportedArchitectures:
  os:
    - current
    - win32
  cpu:
    - current
    - x64
`)
  writeFileSync(patchRecord, `${JSON.stringify(plan)}
`)
  console.log('STAGED', plan.patches.length, verifyDesktopCorePackageSet(stage, version).packages.length)
}

async function materialize(): Promise<void> {
  if (existsSync(output)) throw new Error('portable cross runtime: output already exists; refusing overwrite')
  requireFile(patchRecord)
  const plan = JSON.parse(readFileSync(patchRecord, 'utf8')) as PreparedRuntimePatches
  const set = verifyDesktopCorePackageSet(stage, version)
  verifyRuntimePatches(stage, plan)
  verifyDesktopCoreLockfile(readFileSync(join(stage, 'pnpm-lock.yaml'), 'utf8'), set)
  const modules = join(stage, 'node_modules')
  for (const name of DESKTOP_HOST_RUNTIME_FILES) requireFile(join(modules, DESKTOP_HOST_PACKAGE, name))
  const office = JSON.parse(readFileSync(join(modules, '@deepseek-ai/libreoffice-kit/package.json'), 'utf8'))
  const engine = selectOfficeEngine(office, target)
  requireFile(join(modules, '@deepseek-ai', `libreoffice-kit-${engine}`, 'prebuilds.json'))
  // Do not let --ignore-scripts silently mask a missing native binary.
  for (const name of [
    'node-pty/prebuilds/win32-x64/conpty.node',
    'node-pty/prebuilds/win32-x64/conpty_console_list.node',
    '@deepseek-ai/dsh-desktop-host/node_modules/@koromix/koffi-win32-x64/win32_x64/koffi.node',
  ]) requireFile(join(modules, name))
  mkdirSync(output, { recursive: true })
  cpSync(modules, join(output, 'node_modules'), { recursive: true, dereference: true,
    filter: source => desktopRuntimeFileExclusion(relative(modules, source), target, engine) === undefined })
  writeFileSync(join(output, 'package.json'), `${JSON.stringify({ name: '@deepseek-ai/dsh-desktop-runtime',
    private: true, version, type: 'module', dependencies: Object.fromEntries(set.packages.map(item => [item.name, item.version])),
  }, null, 2)}
`)
  await prepareRuntimeManifests(output)
  const descriptor = writeDesktopRuntime(output, readRelease(), set.packages.map(item => item.name), target)
  await verifyDesktopRuntime(output, version, target)
  console.log('VERIFIED', set.packages.length, descriptor.files.length, engine)
}

async function verify(): Promise<void> {
  requireFile(join(output, 'desktop-runtime.json'))
  const descriptor = await verifyDesktopRuntime(output, version, target)
  const set = verifyDesktopCorePackageSet(paths.packageSet, version)
  if (descriptor.sharedPackages.length !== set.packages.length) throw new Error('portable cross runtime: incomplete package set')
  requireFile(join(output, 'node_modules/node-pty/prebuilds/win32-x64/conpty.node'))
  requireFile(join(output, 'node_modules/@deepseek-ai/dsh-desktop-host/node_modules/@koromix/koffi-win32-x64/win32_x64/koffi.node'))
  console.log('VERIFIED', descriptor.sharedPackages.length, descriptor.files.length)
}

const command = process.argv[2]
if (command === 'bootstrap') bootstrap()
else if (command === 'verify') await verify()
else if (command === 'prepare') await prepare()
else if (command === 'materialize') await materialize()
else throw new Error('usage: prepare-cross-runtime.ts bootstrap|prepare|materialize|verify')
