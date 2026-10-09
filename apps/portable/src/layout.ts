import { posix, win32 } from 'node:path'

/** Mutable directories owned by one extracted Portable package. */
export interface PortablePaths {
  readonly root: string
  readonly appData: string
  readonly dshHome: string
  readonly sessionData: string
  readonly crashDumps: string
  readonly logs: string
  readonly temp: string
  readonly pnpmHome: string
  readonly pnpmStore: string
  readonly npmCache: string
}

/** Resolve every Portable-owned path below the package root's AppData directory. */
export function portablePaths(root: string): PortablePaths {
  const windows = /^[A-Za-z]:/u.test(root) || root.startsWith('\\\\')
  const pathApi = windows ? win32 : posix
  const absolute = pathApi.isAbsolute(root)
  if (!absolute) throw new Error('portable root must be absolute')
  const normalized = pathApi.normalize(root)
  const appData = pathApi.join(normalized, 'AppData')
  return {
    root: normalized,
    appData,
    dshHome: pathApi.join(appData, 'dsh-home'),
    sessionData: pathApi.join(appData, 'session'),
    crashDumps: pathApi.join(appData, 'crashDumps'),
    logs: pathApi.join(appData, 'logs'),
    temp: pathApi.join(appData, 'temp'),
    pnpmHome: pathApi.join(appData, 'pnpm-home'),
    pnpmStore: pathApi.join(appData, 'pnpm-store'),
    npmCache: pathApi.join(appData, 'npm-cache'),
  }
}
