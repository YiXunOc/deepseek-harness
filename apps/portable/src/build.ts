import { execFile } from 'node:child_process'
import { access } from 'node:fs/promises'
import { dirname } from 'node:path'
import { promisify } from 'node:util'
import { assemblePortable } from './assemble.ts'
import { createPortableArchive, type PortableArchiveResult } from './archive.ts'
import { planWindowsPortableBuild, type WindowsPortableBuildInput, type WindowsPortableBuildPlan } from './build-plan.ts'

const runDesktopBuild = async (plan: WindowsPortableBuildPlan): Promise<void> => {
  const command = `${plan.command.executable} ${plan.command.args.join(' ')}`
  await promisify(execFile)('cmd.exe', ['/d', '/s', '/c', command], { cwd: plan.cwd })
}

export interface PortableBuildOptions extends WindowsPortableBuildInput {
  readonly artifactsDir?: string
  readonly version?: string
  readonly commit?: string
  readonly launcherPath?: string
  readonly execute?: (plan: WindowsPortableBuildPlan) => Promise<void>
}

export interface PortableBuildResult {
  readonly plan: WindowsPortableBuildPlan
  readonly archive: PortableArchiveResult
}

/** Build the existing Desktop directory target, assemble it, and archive it. */
export async function buildPortable(options: PortableBuildOptions): Promise<PortableBuildResult> {
  const plan = planWindowsPortableBuild(options)
  if (options.launcherPath === undefined) throw new Error('portable build: --launcher is required')
  await access(options.launcherPath)
  const execute = options.execute ?? runDesktopBuild
  await execute(plan)
  await access(plan.desktopOutputDir)
  const assembly = await assemblePortable({
    sourceDir: plan.desktopOutputDir,
    outputDir: plan.portableOutputDir,
    launcherPath: options.launcherPath,
    metadata: {
      ...(options.version === undefined ? {} : { version: options.version }),
      ...(options.commit === undefined ? {} : { commit: options.commit }),
      desktopBuildCommand: plan.command.args.join(' '),
    },
  })
  const archive = await createPortableArchive({
    packageRoot: assembly.root,
    outputDir: options.artifactsDir ?? dirname(plan.portableOutputDir),
    metadata: {
      ...(options.version === undefined ? {} : { version: options.version }),
      ...(options.commit === undefined ? {} : { commit: options.commit }),
      desktopBuildCommand: plan.command.args.join(' '),
    },
  })
  return { plan, archive }
}
