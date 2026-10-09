import { describe, expect, it } from 'vitest'
import { buildPortable } from '../src/build.ts'

describe('portable build orchestration', () => {
  it('rejects Linux before spawning Desktop packaging', async () => {
    await expect(buildPortable({ hostPlatform: 'linux', hostArch: 'x64', repositoryRoot: '/repo' }))
      .rejects.toThrow('Windows x64')
  })
  it('rejects a missing launcher before starting a Windows build', async () => {
    await expect(buildPortable({ hostPlatform: 'win32', hostArch: 'x64', repositoryRoot: 'C:\\repo', execute: async () => { throw new Error('build must not run') } }))
      .rejects.toThrow('--launcher is required')
  })
})
