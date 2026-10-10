/** Isolated unsigned Windows x64 Portable directory build; never a release installer. */
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createElectronBuilderConfig } from '../desktop/scripts/electron-builder-config.mjs'
import { desktopTargetBuildPaths } from '../desktop/scripts/desktop-build-paths.mjs'

export function portableLocalTestBuilderConfig(environment = process.env) {
  const paths = desktopTargetBuildPaths('win-x64')
  const runtime = join(paths.root, 'dsh-verify')
  const descriptor = join(runtime, 'desktop-runtime.json')
  if (!existsSync(descriptor)) throw new Error('portable local test: verified runtime descriptor is required')
  const metadata = JSON.parse(readFileSync(descriptor, 'utf8'))
  if (metadata.platform !== 'win32' || metadata.arch !== 'x64' || metadata.release?.version !== JSON.parse(readFileSync(new URL('../desktop/package.json', import.meta.url), 'utf8')).version) {
    throw new Error('portable local test: incompatible runtime descriptor')
  }
  const env = { ...environment, DSH_DESKTOP_APP_ID: 'com.deepseek.harness', DSH_DESKTOP_TARGET_PLATFORM: 'win32',
    DSH_DESKTOP_TARGET_ARCH: 'x64', DSH_DESKTOP_UNSIGNED: '1', DSH_PORTABLE_LOCAL_TEST: '1' }
  const config = createElectronBuilderConfig(env, 'win32', 'x64', runtime)
  config.win.target = ['dir']
  config.win.forceCodeSigning = false
  config.publish = null
  config.directories.output = join(paths.root, 'unsigned-portable-local-test')
  if (config.extraMetadata.dshMandatoryUpdatePolicy !== undefined || config.extraMetadata.dshPortableLocalTestNoPolicy !== true
    || config.beforeBuild === undefined || config.beforePack === undefined || config.afterPack === undefined) {
    throw new Error('portable local test: unexpected release configuration')
  }
  return config
}

export default portableLocalTestBuilderConfig()
