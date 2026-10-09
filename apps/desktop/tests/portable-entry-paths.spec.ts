import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { configurePortableDesktopPaths, portableProtocolExecutable } from '../src/portable-entry-paths.ts'

const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'dsh-portable-entry-'))
  roots.push(root)
  mkdirSync(join(root, 'AppData'))
  writeFileSync(join(root, '.dsh-portable'), '{"schemaVersion":1,"layout":"AppData","runtime":"portable"}\n')
  const app = { setPath: vi.fn(), setAppLogsPath: vi.fn() }
  return { root, app, executable: join(root, 'App', 'DeepSeek Harness.exe') }
}

it('does not redirect ordinary Windows application launches', () => {
  const { app, executable } = fixture()
  expect(configurePortableDesktopPaths(app, {}, executable, 'win32', true)).toBe(false)
  expect(app.setPath).not.toHaveBeenCalled()
})

it('binds packaged portable Electron data before ready', () => {
  const { app, executable, root } = fixture()
  expect(configurePortableDesktopPaths(app, { DSH_PORTABLE_ROOT: root, USERPROFILE: '/real/home' }, executable, 'win32', true)).toBe(true)
  expect(app.setPath.mock.calls).toEqual([
    ['userData', join(root, 'AppData', 'electron-user-data')],
    ['sessionData', join(root, 'AppData', 'session')],
    ['crashDumps', join(root, 'AppData', 'crashDumps')],
  ])
  expect(app.setAppLogsPath).toHaveBeenCalledExactlyOnceWith(join(root, 'AppData', 'logs'))
})

it('routes protocol activation through the root launcher only for marked Portable packages', () => {
  const { root, executable } = fixture()
  expect(portableProtocolExecutable({ DSH_PORTABLE_ROOT: root }, executable)).toBe(join(root, 'DSH Desktop Portable.exe'))
  expect(portableProtocolExecutable({}, executable)).toBeUndefined()
})

it('rejects mismatched or unmarked roots', () => {
  const { app, executable, root } = fixture()
  expect(() => configurePortableDesktopPaths(app, { DSH_PORTABLE_ROOT: join(root, 'elsewhere') }, executable, 'win32', true)).toThrow('root')
  rmSync(join(root, '.dsh-portable'))
  expect(() => configurePortableDesktopPaths(app, { DSH_PORTABLE_ROOT: root }, executable, 'win32', true)).toThrow('marker')
  expect(app.setPath).not.toHaveBeenCalled()
})
