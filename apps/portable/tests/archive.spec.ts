import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createPortableArchive } from '../src/archive.ts'

const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })

async function fixture(): Promise<{ root: string; packageRoot: string; output: string }> {
  const root = await mkdtemp('/tmp/dsh-portable-archive-')
  roots.push(root)
  const packageRoot = join(root, 'DSH-Desktop-test-x64-Portable')
  const output = join(root, 'artifacts')
  await mkdir(join(packageRoot, 'AppData'), { recursive: true })
  await mkdir(output, { recursive: true })
  await writeFile(join(packageRoot, 'DSH Desktop.exe'), 'portable-exe')
  await writeFile(join(packageRoot, '.dsh-portable'), '{"schemaVersion":1}\n')
  return { root, packageRoot, output }
}

describe('portable archive', () => {
  it('creates ZIP, SHA-256 and build-info beside the archive', async () => {
    const { packageRoot, output } = await fixture()
    const result = await createPortableArchive({ packageRoot, outputDir: output, metadata: { version: 'test', commit: 'abc' } })

    expect(result.zipPath).toBe(join(output, 'DSH-Desktop-test-x64-Portable.zip'))
    await expect(readFile(result.sha256Path, 'utf8')).resolves.toMatch(/^[a-f0-9]{64}  DSH-Desktop-test-x64-Portable\.zip\n$/u)
    await expect(readFile(result.buildInfoPath, 'utf8')).resolves.toContain('version=test')
    await expect(readFile(result.buildInfoPath, 'utf8')).resolves.toContain('commit=abc')
  })
})
