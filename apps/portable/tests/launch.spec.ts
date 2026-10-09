import { describe, expect, it } from 'vitest'
import { planPortableLaunch } from '../src/launch.ts'

describe('Portable launcher plan', () => {
  it('points the launcher at the package root and injects AppData environment', () => {
    const plan = planPortableLaunch({ packageRoot: 'C:\\Apps\\DSH-Portable', baseEnvironment: { PATH: 'C:\\Windows' } })

    expect(plan.cwd).toBe('C:\\Apps\\DSH-Portable')
    expect(plan.executable).toBe('C:\\Apps\\DSH-Portable\\resources\\app.asar\\DSH Desktop.exe')
    expect(plan.environment.DSH_HOME).toBe('C:\\Apps\\DSH-Portable\\AppData\\dsh-home')
    expect(plan.environment.APPDATA).toBe('C:\\Apps\\DSH-Portable\\AppData')
    expect(plan.environment.PATH).toBe('C:\\Windows')
  })

  it('can prepend the packaged runtime bin without losing PATH', () => {
    const plan = planPortableLaunch({ packageRoot: 'C:\\Apps\\DSH-Portable', runtimeBin: 'C:\\Apps\\DSH-Portable\\resources\\runtime\\bin', baseEnvironment: { PATH: 'C:\\Windows' } })
    expect(plan.environment.PATH).toBe('C:\\Apps\\DSH-Portable\\resources\\runtime\\bin;C:\\Windows')
  })
})
