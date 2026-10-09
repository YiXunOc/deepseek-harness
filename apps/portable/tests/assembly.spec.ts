import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { assemblePortable } from '../src/assemble.ts'
import { portablePaths } from '../src/layout.ts'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture(): Promise<{ source: string; output: string }> {
  const root = await mkdtemp('/tmp/dsh-portable-')
  roots.push(root)
  const source = join(root, 'dir')
  const output = join(root, 'portable')
  await mkdir(source, { recursive: true })
  await mkdir(output, { recursive: true })
  return { source, output }
}

describe('portable assembly', () => {
  it('copies the unpacked application and creates the AppData contract', async () => {
    const { source, output } = await fixture()
    await writeFile(join(source, 'DeepSeek Harness.exe'), 'exe')
    await writeFile(join(source, 'resources.txt'), 'resources')

    const result = await assemblePortable({ sourceDir: source, outputDir: output, metadata: { version: 'test' } })
    const paths = portablePaths(output)

    expect(result.marker).toBe(join(output, '.dsh-portable'))
    await expect(readFile(join(output, 'DeepSeek Harness.exe'), 'utf8')).resolves.toBe('exe')
    await expect(readFile(join(output, 'DSH Desktop Portable.cmd'), 'utf8')).resolves.toContain('set "DSH_HOME=%~dp0AppData\\dsh-home"')
    await expect(readFile(join(output, '.dsh-portable'), 'utf8')).resolves.toContain('schemaVersion')
    await expect(readFile(join(paths.appData, 'layout.json'), 'utf8')).resolves.toContain('AppData')
    await expect(readFile(join(output, 'portable-build.json'), 'utf8')).resolves.toContain('"version":"test"')
  })

  it('refuses to assemble into an existing non-empty output directory', async () => {
    const { source, output } = await fixture()
    await writeFile(join(source, 'DeepSeek Harness.exe'), 'exe')
    await writeFile(join(output, 'existing.txt'), 'keep')

    await expect(assemblePortable({ sourceDir: source, outputDir: output })).rejects.toThrow('non-empty')
  })

  it('rejects symlinks in the application input', async () => {
    const { source, output } = await fixture()
    await writeFile(join(source, 'DeepSeek Harness.exe'), 'exe')
    await symlink('/tmp', join(source, 'linked'))

    await expect(assemblePortable({ sourceDir: source, outputDir: output })).rejects.toThrow('symbolic link')
  })
})
