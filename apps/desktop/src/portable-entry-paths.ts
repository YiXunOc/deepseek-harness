/** Bind only a marked Portable installation's Electron-owned mutable paths. */
import { lstatSync, mkdirSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'

type PortableAppPaths = {
  setPath(name: 'userData' | 'sessionData' | 'crashDumps', path: string): void
  setAppLogsPath(path: string): void
}

export function portableProtocolExecutable(env: NodeJS.ProcessEnv, executable: string): string | undefined {
  const root = env.DSH_PORTABLE_ROOT
  if (root === undefined || resolve(executable) !== join(resolve(root), 'App', 'DeepSeek Harness.exe')) return undefined
  return join(resolve(root), 'DSH Desktop Portable.exe')
}

/** Must run before setAppLogsPath(), the single-instance lock, and Electron ready. */
export function configurePortableDesktopPaths(
  app: PortableAppPaths, env: NodeJS.ProcessEnv, executable: string,
  platform: NodeJS.Platform, packaged: boolean,
): boolean {
  const specified = env.DSH_PORTABLE_ROOT
  if (specified === undefined) return false
  if (platform !== 'win32' || !packaged) throw new Error('portable entry: requires a packaged Windows application')
  if (!specified || !isAbsolute(specified)) throw new Error('portable entry: root must be absolute')
  const root = resolve(specified)
  let matchesRoot = false
  try { matchesRoot = realpathSync(root) === realpathSync(dirname(dirname(executable))) } catch { /* reject below */ }
  if (!matchesRoot || resolve(executable) !== join(root, 'App', 'DeepSeek Harness.exe')) {
    throw new Error('portable entry: root does not match executable')
  }
  const marker = join(root, '.dsh-portable')
  let metadata: unknown
  try {
    const stat = lstatSync(marker)
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('not a real file')
    metadata = JSON.parse(readFileSync(marker, 'utf8')) as unknown
  } catch { throw new Error('portable entry: valid marker is required') }
  if (typeof metadata !== 'object' || metadata === null || !('runtime' in metadata)
    || metadata.runtime !== 'portable' || !('layout' in metadata) || metadata.layout !== 'AppData') {
    throw new Error('portable entry: invalid marker')
  }
  const data = join(root, 'AppData')
  const dataStat = lstatSync(data)
  if (!dataStat.isDirectory() || dataStat.isSymbolicLink()) throw new Error('portable entry: AppData must be a real directory')
  for (const directory of [data, join(data, 'electron-user-data'), join(data, 'session'),
    join(data, 'crashDumps'), join(data, 'logs')]) mkdirSync(directory, { recursive: true })
  app.setPath('userData', join(data, 'electron-user-data'))
  app.setPath('sessionData', join(data, 'session'))
  app.setPath('crashDumps', join(data, 'crashDumps'))
  app.setAppLogsPath(join(data, 'logs'))
  return true
}
