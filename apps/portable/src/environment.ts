import type { PortablePaths } from './layout.ts'

export interface PortableEnvironmentOptions {
  readonly runtimeBin?: string
}

/** Environment contract inherited by Desktop, Host, and package-manager children. */
export function portableEnvironment(
  paths: PortablePaths,
  base: NodeJS.ProcessEnv = process.env,
  options: PortableEnvironmentOptions = {},
): NodeJS.ProcessEnv {
  const path = options.runtimeBin === undefined
    ? base.PATH
    : [options.runtimeBin, base.PATH].filter((value): value is string => value !== undefined && value !== '').join(';')
  return {
    ...base,
    ...(path === undefined ? {} : { PATH: path }),
    APPDATA: paths.appData,
    LOCALAPPDATA: paths.appData,
    USERPROFILE: paths.appData,
    DSH_PORTABLE_ROOT: paths.root,
    DSH_PORTABLE_APP_DATA: paths.appData,
    DSH_HOME: paths.dshHome,
    TEMP: paths.temp,
    TMP: paths.temp,
    TMPDIR: paths.temp,
    PNPM_HOME: paths.pnpmHome,
    npm_config_cache: paths.npmCache,
    npm_config_store_dir: paths.pnpmStore,
  }
}
