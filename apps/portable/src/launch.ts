import { win32 } from 'node:path'
import { portableEnvironment } from './environment.ts'
import { portablePaths, type PortablePaths } from './layout.ts'

export interface PortableLaunchPlan {
  readonly executable: string
  readonly cwd: string
  readonly environment: NodeJS.ProcessEnv
  readonly paths: PortablePaths
}

export interface PortableLaunchOptions {
  readonly packageRoot: string
  readonly executable?: string
  readonly runtimeBin?: string
  readonly baseEnvironment?: NodeJS.ProcessEnv
}

/** Prepare an external-launcher invocation without starting Electron. */
export function planPortableLaunch(options: PortableLaunchOptions): PortableLaunchPlan {
  const root = win32.resolve(options.packageRoot)
  const paths = portablePaths(root)
  return {
    executable: options.executable ?? win32.join(root, 'DSH Desktop Portable.exe'),
    cwd: root,
    environment: portableEnvironment(
      paths,
      options.baseEnvironment,
      options.runtimeBin === undefined ? {} : { runtimeBin: options.runtimeBin },
    ),
    paths,
  }
}
