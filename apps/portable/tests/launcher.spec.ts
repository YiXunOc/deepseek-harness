import { describe, expect, it } from 'vitest'
import { portableLauncherScript } from '../src/launcher.ts'

describe('Portable Windows launcher', () => {
  it('uses the package directory as root and launches the actual Electron executable', () => {
    const script = portableLauncherScript({ executable: 'DeepSeek Harness.exe' })

    expect(script).toContain('set "DSH_PORTABLE_ROOT=%~dp0"')
    expect(script).toContain('set "DSH_PORTABLE_APP_DATA=%~dp0AppData"')
    expect(script).toContain('set "DSH_HOME=%~dp0AppData\\dsh-home"')
    expect(script).toContain('set "APPDATA=%~dp0AppData"')
    expect(script).toContain('set "LOCALAPPDATA=%~dp0AppData"')
    expect(script).toContain('set "TEMP=%~dp0AppData\\temp"')
    expect(script).toContain('set "TMP=%~dp0AppData\\temp"')
    expect(script).toContain('"%~dp0DeepSeek Harness.exe" %*')
  })

  it('rejects executable names containing command injection characters', () => {
    expect(() => portableLauncherScript({ executable: 'bad&evil.exe' })).toThrow('unsafe')
  })
})
