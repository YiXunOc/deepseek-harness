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

Build the GUI-subsystem launcher from `src/portable-launcher.c` as a Windows x64 executable, then pass its path via `--launcher` to `assemble` or `build`. The launcher sets `APPDATA`, `LOCALAPPDATA`, `TEMP`, `TMP`, `TMPDIR`, `DSH_HOME`, and package-manager cache variables before starting `App/DeepSeek Harness.exe`. Preserve the real `USERPROFILE`. The main-process hook binds Electron data paths before ready; ordinary Desktop packaging is unchanged. The normal `build` command requires a Windows x64 host. Linux x64 has a separate isolated, unsigned local-test pipeline below; do not bypass the native release guard.

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

## Repeatable Linux-to-Windows local-test pipeline

The former `alpha.1` Linux/Wine package used uncommitted snapshot-only steps; removing that temporary worktree removed the build environment. The supported **local test** entry is now `apps/portable/scripts/build-win-portable-linux.sh`. It builds the current clean `dev-portable` commit from a fresh detached worktree; it never signs or publishes a release and does not change `apps/desktop/scripts/package-target.ts` or its Windows-host requirement. No mandatory-update service origin or updater feed is invented. An explicit manifest marker enables only the no-policy local-test status bridge on a marked Portable launch.

1. Before starting, commit necessary Portable/Desktop changes to `dev-portable`, fast-forward local `master` to `origin/master`, merge `origin/master` into `dev-portable`, and verify a clean primary checkout. Use the approved proxy for network operations. Require at least 12 GiB free, Linux x86-64, Node 22.19+ or 24+, pnpm/Corepack, Wine, MinGW-w64, zip/unzip, Python 3, and a functional X/Windows test environment for later UI acceptance.
2. From the repository root, set the approved proxy and run:

   ```sh
   export HTTP_PROXY=http://xxw:7897 HTTPS_PROXY=http://xxw:7897 ALL_PROXY=http://xxw:7897
   export NO_PROXY=127.0.0.1,localhost,::1,xxw
   bash apps/portable/scripts/build-win-portable-linux.sh
   ```

3. The script pins `HEAD`, fetches `origin/master` and refuses unmerged upstream or dirty input. It creates a detached worktree under `$TMPDIR/dsh-portable-builds/`; only that worktree gets temporary Windows dependency architecture and hoisted-linker configuration. It performs the official build, packs all local DSH/vendor/Host/native tarballs, prepares the Windows primary runtime and Electron, resolves the Desktop production package set and patches, materializes a verified Windows runtime, then invokes electron-builder's Windows `--dir` target with its `beforePack`/`afterPack` and normal dependency collector intact. It compiles the GUI launcher, assembles the single-root-EXE layout, and checks ZIP CRC, SHA-256, every extracted byte, Windows x64 PE binaries, ASAR manifest/entry, commit, policy marker, and native files.
4. Successful logs, ZIP, checksums and provenance remain under `.artifacts/portable/<version>-<commit>-<unique>/`; the temporary worktree and full extraction are removed **only after verification**. On failure the exact failing log and worktree remain for diagnosis—fix the failing stage, not the entire package by guesswork. Old ZIPs are never reused as newer versions. Do not delete a failed worktree without preserving unique source changes and logs.
5. This is an **unsigned local test build**, not an official Windows release. Wine Node-mode probes are supplementary; a native Windows x64 full extraction and GUI/Host/ConPTY/Office/plugin startup plus external-write audit are still required before calling it release-ready or fully portable.

`src/cli.ts build` remains native-Windows-only for the ordinary packaging route. Local cross-build policy changes and scripts live on `dev-portable`, not in a temporary worktree; snapshot-only dependency layout is regenerated by the script each time.
