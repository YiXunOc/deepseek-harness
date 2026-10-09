const SAFE_EXE = /^[A-Za-z0-9 ._-]+\.exe$/u

export interface PortableLauncherOptions {
  readonly executable: string
}

/** Generate a Windows cmd launcher that confines inherited user-data paths to AppData. */
export function portableLauncherScript(options: PortableLauncherOptions): string {
  if (!SAFE_EXE.test(options.executable)) throw new Error('portable launcher: unsafe executable name')
  return `@echo off\r\nsetlocal\r\nset "DSH_PORTABLE_ROOT=%~dp0"\r\nset "DSH_PORTABLE_APP_DATA=%~dp0AppData"\r\nset "DSH_HOME=%~dp0AppData\\dsh-home"\r\nset "APPDATA=%~dp0AppData"\r\nset "LOCALAPPDATA=%~dp0AppData"\r\nset "USERPROFILE=%~dp0AppData"\r\nset "TEMP=%~dp0AppData\\temp"\r\nset "TMP=%~dp0AppData\\temp"\r\nset "TMPDIR=%~dp0AppData\\temp"\r\nset "PNPM_HOME=%~dp0AppData\\pnpm-home"\r\nset "npm_config_cache=%~dp0AppData\\npm-cache"\r\nset "npm_config_store_dir=%~dp0AppData\\pnpm-store"\r\n"%~dp0${options.executable}" %*\r\nexit /b %ERRORLEVEL%\r\n`
}
