# Windows x64 Portable packaging

This application assembles a Windows x64 portable distribution from the repository's existing Desktop build. Portable-specific orchestration belongs here; do not fork or patch Harness packages for portable behavior unless a verified runtime blocker requires a minimal upstream change.

## Data-root contract

The extracted package root owns all mutable state:

```text
<package-root>/
  DSH Desktop.exe
  .dsh-portable
  resources/
  AppData/
    dsh-home/       # DSH_HOME: profiles, sessions, plugins, settings, and DSH state
    session/        # Chromium session/cache data when separately configurable
    crashDumps/
    logs/
    temp/
    pnpm-home/
    pnpm-store/
    npm-cache/
```

`src/layout.ts` computes the deterministic layout for either POSIX build hosts or Windows paths. `src/environment.ts` creates the inherited environment for the launcher and all descendants while preserving unrelated variables.

## Minimal-source-change strategy

First evaluate an external Windows launcher that sets `APPDATA`, `LOCALAPPDATA`, `TEMP`, `TMP`, `TMPDIR`, `DSH_HOME`, and package-manager cache variables before starting the existing Electron executable. Keep the Electron payload under a separate internal executable name and expose the launcher as `DSH Desktop.exe` only if Electron packaging, protocol registration, single-instance behavior, crash reporting, and updater interactions remain correct. Do not claim complete process-level isolation until native Windows probes show that Electron, Host, package-manager children, bundled runtimes, and plugins do not write persistent state outside `AppData`.

If environment-based redirection cannot set Electron's exact `userData`, `sessionData`, or crash paths before Electron initializes, propose the smallest Desktop entry-point hook as a separately reviewable change. Do not silently widen the patch into Harness packages.

## Build and validation requirements

- Build the existing Desktop payload for Windows x64; do not treat the NSIS installer as the Portable ZIP.
- Assemble the unpacked app directory, preserve `resources` and required native payloads, add `.dsh-portable`, and create `AppData`.
- Emit ZIP, SHA-256, and build metadata with Desktop/Harness commit and runtime/package provenance.
- Verify ZIP CRC, executable/native PE architecture, expected runtime files, and full extraction.
- Run a native Windows launch test. Linux/Wine evidence is supplementary and is not a substitute for Windows UI, path-isolation, or persistence validation.

Portable tests are run through the repository root Vitest installation, for example:

```sh
pnpm exec vitest run apps/portable/tests --config vitest.config.ts
pnpm exec tsc -p apps/portable/tsconfig.json --noEmit
```
