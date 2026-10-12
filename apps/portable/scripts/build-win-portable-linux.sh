#!/usr/bin/env bash
# Reproducible unsigned Windows x64 local-test Portable build on Linux.
set -Eeuo pipefail
repo="$(git -C "$(dirname "${BASH_SOURCE[0]}")/../../.." rev-parse --show-toplevel)"
[[ "$(uname -s)" == Linux && "$(uname -m)" == x86_64 ]] || { echo 'Linux x86_64 build host required' >&2; exit 1; }
[[ "$(git -C "$repo" branch --show-current)" == dev-portable ]] || { echo 'dev-portable branch required' >&2; exit 1; }
[[ -z "$(git -C "$repo" status --porcelain --untracked-files=all)" ]] || { echo 'Commit all source changes before building' >&2; exit 1; }
: "${HTTP_PROXY:?Set the approved proxy before network stages}"
: "${HTTPS_PROXY:?Set the approved proxy before network stages}"
export HTTP_PROXY HTTPS_PROXY ALL_PROXY="${ALL_PROXY:-$HTTPS_PROXY}"
export NO_PROXY="${NO_PROXY:-127.0.0.1,localhost,::1,xxw}"
export npm_config_proxy="$HTTP_PROXY" npm_config_https_proxy="$HTTPS_PROXY"
export NODE_USE_ENV_PROXY=1 ELECTRON_GET_USE_PROXY=1 npm_config_confirm_modules_purge=false
curl --proxy "$HTTPS_PROXY" -fsS --max-time 25 -o /dev/null https://registry.npmjs.org/pnpm
# Refresh tracking refs, but never silently merge or change the user's branch.
git -C "$repo" -c http.version=HTTP/1.1 fetch --prune origin master
remote="$(git -C "$repo" rev-parse origin/master)"
[[ "$(git -C "$repo" rev-parse master)" == "$remote" ]] || { echo 'Fast-forward local master first' >&2; exit 1; }
git -C "$repo" merge-base --is-ancestor "$remote" HEAD || { echo 'Merge origin/master into dev-portable first' >&2; exit 1; }
commit="$(git -C "$repo" rev-parse HEAD)"
short="${commit:0:10}"
version="$(node -p 'require(process.argv[1]).version' "$repo/apps/desktop/package.json")"
avail="$(df -B1 --output=avail "$repo" | python3 -c 'import sys; print(int(sys.stdin.read().splitlines()[-1]))')"
(( avail >= 12*1024*1024*1024 )) || { echo 'Need at least 12 GiB available for isolated build' >&2; exit 1; }
for executable in git corepack node python3 zip unzip sha256sum wine x86_64-w64-mingw32-gcc x86_64-w64-mingw32-windres file curl; do
  command -v "$executable" >/dev/null || { echo "Missing $executable" >&2; exit 1; }
done
mkdir -p "$repo/.artifacts/portable" "${TMPDIR:-$HOME/.cache}/dsh-portable-builds"
out="$(mktemp -d "$repo/.artifacts/portable/${version}-${short}-XXXXXXXX")"
work="$(mktemp -d "${TMPDIR:-$HOME/.cache}/dsh-portable-builds/${version}-${short}-XXXXXXXX")"
wt="$work/tree"
mkdir -p "$out/logs" "$out/artifacts"
step() {
  local name="$1"; shift
  echo "[$name] starting"
  if "$@" > "$out/logs/$name.log" 2>&1; then
    echo "[$name] complete"
  else
    local code=$?
    echo "[$name] FAILED (exit $code); retained: $out/logs/$name.log; worktree: $wt" >&2
    python3 - "$out/logs/$name.log" <<'PY'
from pathlib import Path
import sys
print('\n'.join(Path(sys.argv[1]).read_text(errors='replace').splitlines()[-35:]))
PY
    exit "$code"
  fi
}
trap 'echo "Build interrupted; preserve logs $out and worktree $wt" >&2' ERR INT TERM
step worktree git -C "$repo" worktree add --detach "$wt" "$commit"
[[ "$(git -C "$wt" rev-parse HEAD)" == "$commit" ]] || exit 1
cd "$wt"
python3 - <<'PY'
from pathlib import Path
p=Path('pnpm-workspace.yaml')
s=p.read_text()
needle='\noverrides:\n'
assert s.count(needle)==1 and 'supportedArchitectures:' not in s
s=s.replace(needle,'\nnodeLinker: hoisted\nsupportedArchitectures:\n  os:\n    - current\n    - win32\n  cpu:\n    - current\n    - x64\n'+needle)
p.write_text(s)
PY
step install corepack pnpm install --no-frozen-lockfile
step build corepack pnpm run build:official
packed="$wt/apps/desktop/.desktop-build/targets/win-x64/packed"
mkdir -p "$packed/dsh" "$packed/vendor" "$packed/landlock"
step pack_dsh corepack pnpm run release:pack --family dsh --out "$packed/dsh"
step pack_host corepack pnpm --dir apps/desktop-host pack --pack-destination "$packed/dsh"
step pack_vendor corepack pnpm run release:pack --family vendor --out "$packed/vendor"
step build_native corepack pnpm --dir native/system run build:ts
step pack_native corepack pnpm --dir native/system/packages/entry pack --pack-destination "$packed/landlock"
export DSH_DESKTOP_TARGET_PLATFORM=win32 DSH_DESKTOP_TARGET_ARCH=x64
step package_set corepack pnpm --dir apps/desktop run prepare:packages
step electron node apps/portable/scripts/prepare-cross-electron.mjs
step primary_runtime corepack pnpm exec tsx scripts/primary-runtime/prepare.ts --target win-x64 --output apps/desktop/.desktop-build/targets/win-x64/runtime --cache apps/desktop/.desktop-build/downloads
step bootstrap corepack pnpm exec tsx apps/portable/scripts/prepare-cross-runtime.ts bootstrap
step stage corepack pnpm exec tsx apps/portable/scripts/prepare-cross-runtime.ts prepare
stage="$wt/apps/desktop/.desktop-build/targets/win-x64/portable-cross-stage"
step runtime_lock corepack pnpm --dir "$stage" install --lockfile-only
step runtime_install corepack pnpm --dir "$stage" install --prod --frozen-lockfile --ignore-scripts
step runtime_materialize corepack pnpm exec tsx apps/portable/scripts/prepare-cross-runtime.ts materialize
step runtime_verify corepack pnpm exec tsx apps/portable/scripts/prepare-cross-runtime.ts verify
step desktop_type corepack pnpm exec tsc -p apps/desktop/tsconfig.json --noEmit
step portable_type corepack pnpm exec tsc -p apps/portable/tsconfig.json --noEmit
step tests corepack pnpm exec vitest run apps/portable/tests apps/desktop/tests/portable-local-test-policy.spec.ts apps/desktop/tests/portable-entry-paths.spec.ts apps/desktop/tests/desktop-policy-environment.spec.ts --config vitest.config.ts
export DSH_PORTABLE_LOCAL_TEST=1 DSH_DESKTOP_UNSIGNED=1 DSH_DESKTOP_BUILD_COMMIT="$commit" DSH_DESKTOP_BUILD_DIRTY=0
step builder bash -c 'cd "$1/apps/desktop" && node ../../node_modules/electron-builder/cli.js --win --x64 --dir --config ../portable/electron-builder.portable.config.mjs' _ "$wt"
payload="$wt/apps/desktop/.desktop-build/targets/win-x64/unsigned-portable-local-test/win-unpacked"
[[ -s "$payload/resources/app.asar" && -s "$payload/DeepSeek Harness.exe" ]] || { echo 'Builder omitted Windows payload' >&2; exit 1; }
launcher="$out/artifacts/portable-launcher.exe"
step launcher_icon node apps/portable/scripts/prepare-launcher-icon.mjs "$out/launcher-icon.ico"
printf '1 ICON "%s"\n' "$out/launcher-icon.ico" > "$out/launcher-icon.rc"
step launcher_resource x86_64-w64-mingw32-windres -i "$out/launcher-icon.rc" -O coff -o "$out/launcher-icon.o"
step launcher x86_64-w64-mingw32-gcc -municode -mwindows -O2 -Wall -Wextra -o "$launcher" apps/portable/src/portable-launcher.c "$out/launcher-icon.o"
step verify_launcher_icon python3 apps/portable/scripts/verify-launcher-icon.py "$launcher" "$out/launcher-icon.ico"
assembly="$wt/apps/portable/.build/DSH-Desktop-${version}-x64-Portable-local-test-${short}"
step assemble corepack pnpm exec tsx apps/portable/src/cli.ts assemble --source "$payload" --output "$assembly" --launcher "$launcher" --version "$version" --commit "$commit"
step archive corepack pnpm exec tsx apps/portable/src/cli.ts archive --source "$assembly" --artifacts "$out/artifacts" --version "$version" --commit "$commit"
zip="$out/artifacts/$(basename "$assembly").zip"
step verify python3 apps/portable/scripts/verify-cross-portable.py "$assembly" "$zip"
# Extract the complete ZIP: opening an EXE alone does not test its sibling resources.
step extract python3 -c 'import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])' "$zip" "$out/extracted"
step verify_extracted python3 apps/portable/scripts/verify-cross-portable.py "$out/extracted/$(basename "$assembly")" "$zip"
step wine_launcher python3 apps/portable/tests/launcher-smoke.py
printf 'commit=%s\nversion=%s\nkind=unsigned local test, no mandatory policy origin or updater feed\nnative_windows_gui=not verified\n' "$commit" "$version" > "$out/artifacts/provenance.txt"
(cd "$out/artifacts" && sha256sum "$(basename "$zip")" portable-launcher.exe > SHA256SUMS && sha256sum -c SHA256SUMS)
# Retain ZIP, checksums, provenance and logs; remove derived extraction/worktree only on success.
rm -rf -- "$out/extracted"
git -C "$repo" worktree remove --force "$wt"
[[ ! -e "$wt" ]] || { echo 'Worktree cleanup incomplete' >&2; exit 1; }
rmdir "$work"
trap - ERR INT TERM
printf 'PORTABLE_OK=%s\nSOURCE_COMMIT=%s\n' "$zip" "$commit"
