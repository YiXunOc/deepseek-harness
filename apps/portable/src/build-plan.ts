import { win32 } from 'node:path'

export interface WindowsPortableBuildInput {
  readonly hostPlatform: NodeJS.Platform
  readonly hostArch: string
  readonly repositoryRoot: string
}

export interface WindowsPortableBuildPlan {
  readonly command: { readonly executable: 'pnpm.cmd'; readonly args: readonly string[] }
  readonly cwd: string
  readonly desktopOutputDir: string
  readonly portableOutputDir: string
}

/** Describe, but do not execute, the existing Windows x64 Desktop directory build. */
export function planWindowsPortableBuild(input: WindowsPortableBuildInput): WindowsPortableBuildPlan {
  if (input.hostPlatform !== 'win32' || input.hostArch !== 'x64') {
    throw new Error('portable build: Windows x64 build host is required')
  }
  const root = win32.resolve(input.repositoryRoot)
  return {
    command: { executable: 'pnpm.cmd', args: ['run', 'package:desktop:win:x64:dir'] },
    cwd: root,
    desktopOutputDir: win32.join(root, 'apps', 'desktop', '.desktop-build', 'targets', 'win-x64', 'unsigned-artifacts', 'win-unpacked'),
    portableOutputDir: win32.join(root, 'apps', 'portable', '.build', 'win-x64'),
  }
}
