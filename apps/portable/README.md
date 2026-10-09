# Windows x64 Portable packaging

This application assembles a Windows x64 portable distribution from the repository's existing Desktop build. Portable-specific orchestration belongs here; do not fork or patch Harness packages for portable behavior unless a verified runtime blocker requires a minimal upstream change.

## Data-root contract

The extracted package root owns all mutable state:

```text
<package-root>/
  DSH Desktop Portable.exe  # sole root launcher
  .dsh-portable
  App/                       # complete Electron payload, including DeepSeek Harness.exe and resources/
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

Build the GUI-subsystem launcher from `src/portable-launcher.c` as a Windows x64 executable, then pass its path via `--launcher` to `assemble` or `build`. The launcher sets `APPDATA`, `LOCALAPPDATA`, `TEMP`, `TMP`, `TMPDIR`, `DSH_HOME`, and package-manager cache variables before starting `App/DeepSeek Harness.exe`. Preserve the real `USERPROFILE`. The main-process hook binds Electron data paths before ready; ordinary Desktop packaging is unchanged. The `build` command requires a Windows x64 host; the prior isolated Linux/Wine experiment is not a supported build entry.

The archive must have only `DSH Desktop Portable.exe` at its root, with the full Electron payload under `App/`. Do not claim complete process-level isolation until native Windows probes show that Electron, Host, package-manager children, bundled runtimes, and plugins do not write persistent state outside `AppData`.

For example, compile the launcher with a Windows x64 MinGW toolchain, then invoke `pnpm --filter @deepseek-ai/dsh-portable build -- --repository <repo> --launcher <compiled-launcher.exe>` on a Windows x64 build host. A Linux-built launcher can be checked under Wine for arguments and environment, but Wine is not a native Windows Desktop startup test.

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
