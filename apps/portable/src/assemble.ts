import { cp, lstat, mkdir, readdir, writeFile } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { portablePaths, type PortablePaths } from './layout.ts'
import { portableLauncherScript } from './launcher.ts'

export interface PortableBuildMetadata {
  readonly [key: string]: unknown
}

export interface PortableAssemblyOptions {
  readonly sourceDir: string
  readonly outputDir: string
  readonly metadata?: PortableBuildMetadata
}

export interface PortableAssemblyResult {
  readonly root: string
  readonly appData: string
  readonly marker: string
  readonly metadata: string
}

async function assertNoSymlinks(root: string): Promise<void> {
  const entries = await readdir(root, { withFileTypes: true })
  for (const entry of entries) {
    const path = join(root, entry.name)
    const stat = await lstat(path)
    if (stat.isSymbolicLink()) throw new Error(`portable assembly: symbolic link is not allowed: ${path}`)
    if (stat.isDirectory()) await assertNoSymlinks(path)
  }
}

async function ensureEmptyOutput(output: string): Promise<void> {
  try {
    const entries = await readdir(output)
    if (entries.length > 0) throw new Error(`portable assembly: output directory is non-empty: ${output}`)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    await mkdir(output, { recursive: true })
  }
}

function json(value: unknown): string {
  return `${JSON.stringify(value)}\n`
}

/** Assemble an unpacked Desktop directory into a fresh Portable root. */
export async function assemblePortable(options: PortableAssemblyOptions): Promise<PortableAssemblyResult> {
  const source = resolve(options.sourceDir)
  const output = resolve(options.outputDir)
  if (source === output || output.startsWith(`${source}${sep}`)) {
    throw new Error('portable assembly: output must not be inside source')
  }
  const sourceStat = await lstat(source)
  if (!sourceStat.isDirectory() || sourceStat.isSymbolicLink()) throw new Error('portable assembly: source must be a real directory')
  await assertNoSymlinks(source)
  await ensureEmptyOutput(output)
  for (const entry of await readdir(source)) {
    await cp(join(source, entry), join(output, entry), { recursive: true, errorOnExist: true, force: false })
  }

  const paths: PortablePaths = portablePaths(output)
  await mkdir(paths.appData, { recursive: true })
  for (const directory of [paths.dshHome, paths.sessionData, paths.crashDumps, paths.logs, paths.temp,
    paths.pnpmHome, paths.pnpmStore, paths.npmCache]) await mkdir(directory, { recursive: true })
  const executable = join(output, 'DeepSeek Harness.exe')
  const executableStat = await lstat(executable).catch(() => undefined)
  if (executableStat === undefined || !executableStat.isFile() || executableStat.isSymbolicLink()) {
    throw new Error('portable assembly: DeepSeek Harness.exe is required at package root')
  }
  const launcher = join(output, 'DSH Desktop Portable.cmd')
  await writeFile(launcher, portableLauncherScript({ executable: 'DeepSeek Harness.exe' }), { flag: 'wx' })
  const marker = join(output, '.dsh-portable')
  const metadata = join(output, 'portable-build.json')
  await writeFile(marker, json({ schemaVersion: 1, layout: 'AppData', runtime: 'portable' }), { flag: 'wx' })
  await writeFile(join(paths.appData, 'layout.json'), json({ schemaVersion: 1, root: paths.root, appData: paths.appData }), { flag: 'wx' })
  await writeFile(metadata, json({ schemaVersion: 1, sourceDir: source, ...options.metadata }), { flag: 'wx' })
  return { root: output, appData: paths.appData, marker, metadata }
}
