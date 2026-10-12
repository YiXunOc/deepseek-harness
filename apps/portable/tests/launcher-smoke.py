#!/usr/bin/env python3
"""Wine smoke for the Windows portable launcher; no full Desktop runtime needed."""
import os
import pathlib
import subprocess
import tempfile

repo = pathlib.Path(__file__).resolve().parents[1]
launcher_src = repo / 'src' / 'portable-launcher.c'
assert launcher_src.is_file(), f'launcher source missing: {launcher_src}'
probe = r'''
#include <windows.h>
#include <stdio.h>
#include <wchar.h>
int wmain(int argc, wchar_t **argv) {
  wchar_t root[32768], value[32768], want[32768];
  DWORD count = GetEnvironmentVariableW(L"DSH_PORTABLE_ROOT", root, 32768);
  if (!count || count >= 32768) return 10;
  const wchar_t *vars[] = {L"DSH_PORTABLE_APP_DATA",L"APPDATA",L"LOCALAPPDATA",L"DSH_HOME",L"TEMP",L"TMP",L"TMPDIR",L"PNPM_HOME",L"npm_config_cache",L"npm_config_store_dir"};
  const wchar_t *suffix[] = {L"AppData",L"AppData",L"AppData",L"AppData\\dsh-home",L"AppData\\temp",L"AppData\\temp",L"AppData\\temp",L"AppData\\pnpm-home",L"AppData\\npm-cache",L"AppData\\pnpm-store"};
  for (int i=0; i<10; ++i) {
    swprintf(want, 32768, L"%ls\\%ls", root, suffix[i]);
    DWORD n = GetEnvironmentVariableW(vars[i], value, 32768);
    if (!n || n >= 32768 || _wcsicmp(want,value)) return 20+i;
  }
  DWORD n = GetEnvironmentVariableW(L"USERPROFILE", value, 32768);
  if (!n || n >= 32768 || wcsstr(value,root) == value) return 40;
  if (argc != 3 || wcscmp(argv[1],L"with space") || wcscmp(argv[2],L"second")) return 41;
  return 42;
}
'''
with tempfile.TemporaryDirectory(prefix='dsh-launcher-', dir=os.environ.get('TMPDIR')) as tmp:
    root = pathlib.Path(tmp) / 'Portable With Space'
    app = root / 'App'
    app.mkdir(parents=True)
    subprocess.run(['x86_64-w64-mingw32-gcc', '-municode', '-O2', '-o', str(app / 'DeepSeek Harness.exe'), '-x', 'c', '-'], input=probe, text=True, check=True)
    icon = pathlib.Path(tmp) / 'icon.ico'
    resource = pathlib.Path(tmp) / 'icon.rc'
    obj = pathlib.Path(tmp) / 'icon.o'
    subprocess.run(['node', str(repo / 'scripts' / 'prepare-launcher-icon.mjs'), str(icon)], check=True)
    resource.write_text(f'1 ICON "{icon}"\n')
    subprocess.run(['x86_64-w64-mingw32-windres', '-i', str(resource), '-O', 'coff', '-o', str(obj)], check=True)
    launcher = root / 'DSH Desktop Portable.exe'
    subprocess.run(['x86_64-w64-mingw32-gcc', '-municode', '-mwindows', '-O2', '-o', str(launcher), str(launcher_src), str(obj)], check=True)
    subprocess.run(['python3', str(repo / 'scripts' / 'verify-launcher-icon.py'), str(launcher), str(icon)], check=True)
    env = {**os.environ, 'USERPROFILE': 'C:\\Users\\real-user'}
    result = subprocess.run(['wine', str(root / 'DSH Desktop Portable.exe'), 'with space', 'second'], env=env, timeout=60, capture_output=True, text=True)
    print('Wine launcher child exit:', result.returncode)
    if result.returncode != 42:
        print(result.stderr[-2500:])
        raise SystemExit(1)
