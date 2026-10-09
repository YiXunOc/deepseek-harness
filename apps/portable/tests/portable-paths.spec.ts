import { describe, expect, it } from 'vitest'
import { portablePaths } from '../src/layout.ts'
import { portableEnvironment } from '../src/environment.ts'

const root = 'C:\\Apps\\DSH-Portable'

describe('portable layout', () => {
  it('keeps all mutable application data below AppData at the package root', () => {
    const paths = portablePaths(root)

    expect(paths.root).toBe(root)
    expect(paths.appData).toBe('C:\\Apps\\DSH-Portable\\AppData')
    expect(paths.dshHome).toBe('C:\\Apps\\DSH-Portable\\AppData\\dsh-home')
    expect(paths.sessionData).toBe('C:\\Apps\\DSH-Portable\\AppData\\session')
    expect(paths.crashDumps).toBe('C:\\Apps\\DSH-Portable\\AppData\\crashDumps')
    expect(paths.logs).toBe('C:\\Apps\\DSH-Portable\\AppData\\logs')
    expect(paths.temp).toBe('C:\\Apps\\DSH-Portable\\AppData\\temp')
    expect(paths.pnpmStore).toBe('C:\\Apps\\DSH-Portable\\AppData\\pnpm-store')
    expect(paths.npmCache).toBe('C:\\Apps\\DSH-Portable\\AppData\\npm-cache')
  })

  it('rejects a package root that is not absolute', () => {
    expect(() => portablePaths('relative-root')).toThrow('absolute')
  })
})

describe('portable child environment', () => {
  it('injects the portable roots without discarding unrelated variables', () => {
    const paths = portablePaths(root)
    const environment = portableEnvironment(paths, { PATH: 'C:\\Windows\\System32', DSH_HOME: 'old' })

    expect(environment.PATH).toBe('C:\\Windows\\System32')
    expect(environment.APPDATA).toBe(paths.appData)
    expect(environment.LOCALAPPDATA).toBe(paths.appData)
    expect(environment.USERPROFILE).toBe(paths.appData)
    expect(environment.DSH_PORTABLE_ROOT).toBe(root)
    expect(environment.DSH_PORTABLE_APP_DATA).toBe(paths.appData)
    expect(environment.DSH_HOME).toBe(paths.dshHome)
    expect(environment.TEMP).toBe(paths.temp)
    expect(environment.TMP).toBe(paths.temp)
    expect(environment.TMPDIR).toBe(paths.temp)
    expect(environment.PNPM_HOME).toBe(paths.pnpmHome)
    expect(environment.npm_config_cache).toBe(paths.npmCache)
    expect(environment.npm_config_store_dir).toBe(paths.pnpmStore)
  })
})
