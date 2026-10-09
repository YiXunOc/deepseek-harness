import { parseArgs } from 'node:util'
import { assemblePortable } from './assemble.ts'
import { buildPortable } from './build.ts'
import { createPortableArchive } from './archive.ts'

function required(values: Record<string, string | boolean | undefined>, name: string): string {
  const value = values[name]
  if (typeof value !== 'string' || value === '') throw new Error(`portable CLI: --${name} is required`)
  return value
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      repository: { type: 'string' },
      source: { type: 'string' },
      launcher: { type: 'string' },
      output: { type: 'string' },
      artifacts: { type: 'string' },
      version: { type: 'string' },
      commit: { type: 'string' },
    },
  })
  const command = positionals[0]
  if (command !== 'assemble' && command !== 'archive' && command !== 'build') {
    throw new Error('portable CLI: command must be assemble, archive or build')
  }
  if (command === 'build') {
    const result = await buildPortable({
      hostPlatform: process.platform,
      hostArch: process.arch,
      repositoryRoot: required(values, 'repository'),
      ...(typeof values.launcher === 'string' ? { launcherPath: values.launcher } : {}),
      ...(typeof values.artifacts === 'string' ? { artifactsDir: values.artifacts } : {}),
      ...(typeof values.version === 'string' ? { version: values.version } : {}),
      ...(typeof values.commit === 'string' ? { commit: values.commit } : {}),
    })
    process.stdout.write(`Portable archive: ${result.archive.zipPath}\nSHA-256: ${result.archive.sha256Path}\nBuild info: ${result.archive.buildInfoPath}\n`)
    return
  }
  const packageRoot = command === 'assemble'
    ? required(values, 'output')
    : required(values, 'source')
  if (command === 'assemble') {
    const result = await assemblePortable({
      sourceDir: required(values, 'source'),
      outputDir: packageRoot,
      ...(typeof values.launcher === 'string' ? { launcherPath: values.launcher } : {}),
      metadata: {
        ...(typeof values.version === 'string' ? { version: values.version } : {}),
        ...(typeof values.commit === 'string' ? { commit: values.commit } : {}),
      },
    })
    process.stdout.write(`Portable directory assembled: ${result.root}\n`)
    return
  }
  const result = await createPortableArchive({
    packageRoot,
    outputDir: required(values, 'artifacts'),
    metadata: {
      ...(typeof values.version === 'string' ? { version: values.version } : {}),
      ...(typeof values.commit === 'string' ? { commit: values.commit } : {}),
    },
  })
  process.stdout.write(`Portable archive: ${result.zipPath}\nSHA-256: ${result.sha256Path}\nBuild info: ${result.buildInfoPath}\n`)
}

await main()
