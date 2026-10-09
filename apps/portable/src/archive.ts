import { execFile } from 'node:child_process'
import { access, lstat, mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

export interface PortableArchiveOptions {
  readonly packageRoot: string
  readonly outputDir: string
  readonly metadata?: Readonly<Record<string, string>>
}

export interface PortableArchiveResult {
  readonly zipPath: string
  readonly sha256Path: string
  readonly buildInfoPath: string
}

async function requirePortableRoot(root: string): Promise<void> {
  const stat = await lstat(root)
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('portable archive: package root must be a real directory')
  await access(join(root, '.dsh-portable'))
  const appData = await lstat(join(root, 'AppData'))
  if (!appData.isDirectory() || appData.isSymbolicLink()) throw new Error('portable archive: AppData directory is required')
}

function buildInfo(metadata: Readonly<Record<string, string>> | undefined): string {
  return Object.entries(metadata ?? {}).map(([key, value]) => `${key}=${value}`).concat(['runtime=portable', 'layout=AppData']).join('\n') + '\n'
}

/** Create a reproducible-name ZIP and companion provenance files from a Portable root. */
export async function createPortableArchive(options: PortableArchiveOptions): Promise<PortableArchiveResult> {
  const packageRoot = resolve(options.packageRoot)
  const outputDir = resolve(options.outputDir)
  await requirePortableRoot(packageRoot)
  await mkdir(outputDir, { recursive: true })
  const archiveName = `${basename(packageRoot)}.zip`
  const zipPath = join(outputDir, archiveName)
  const sha256Path = `${zipPath}.sha256`
  const buildInfoPath = `${zipPath}.build-info.txt`
  await run('zip', ['-q', '-r', zipPath, basename(packageRoot)], { cwd: dirname(packageRoot) })
  const digest = (await run('sha256sum', [zipPath])).stdout.trim().split(/\s+/u)[0]
  if (digest === undefined || !/^[a-f0-9]{64}$/u.test(digest)) throw new Error('portable archive: failed to compute SHA-256')
  await writeFile(sha256Path, `${digest}  ${archiveName}\n`, { flag: 'wx' })
  await writeFile(buildInfoPath, buildInfo(options.metadata), { flag: 'wx' })
  return { zipPath, sha256Path, buildInfoPath }
}
