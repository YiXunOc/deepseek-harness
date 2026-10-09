import { describe, expect, it } from 'vitest'
import { buildPortable } from '../src/build.ts'

describe('portable build orchestration', () => {
  it('rejects Linux before spawning Desktop packaging', async () => {
    await expect(buildPortable({ hostPlatform: 'linux', hostArch: 'x64', repositoryRoot: '/repo' }))
      .rejects.toThrow('Windows x64')
  })
})
