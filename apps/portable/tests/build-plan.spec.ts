import { describe, expect, it } from 'vitest'
import { planWindowsPortableBuild } from '../src/build-plan.ts'

describe('Windows Portable build plan', () => {
  it('rejects non-Windows or non-x64 hosts before starting Desktop packaging', () => {
    expect(() => planWindowsPortableBuild({ hostPlatform: 'linux', hostArch: 'x64', repositoryRoot: '/repo' }))
      .toThrow('Windows x64')
    expect(() => planWindowsPortableBuild({ hostPlatform: 'win32', hostArch: 'arm64', repositoryRoot: 'C:\\repo' }))
      .toThrow('Windows x64')
  })

  it('uses the existing Desktop directory package command on Windows x64', () => {
    const plan = planWindowsPortableBuild({ hostPlatform: 'win32', hostArch: 'x64', repositoryRoot: 'C:\\repo' })

    expect(plan.command).toEqual({ executable: 'pnpm.cmd', args: ['run', 'package:desktop:win:x64:dir'] })
    expect(plan.cwd).toBe('C:\\repo')
    expect(plan.desktopOutputDir).toBe('C:\\repo\\apps\\desktop\\.desktop-build\\targets\\win-x64\\unsigned-artifacts\\win-unpacked')
    expect(plan.portableOutputDir).toBe('C:\\repo\\apps\\portable\\.build\\win-x64')
  })
})
