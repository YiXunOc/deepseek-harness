#include <windows.h>
#include <wchar.h>
#include <stdlib.h>

static int fail(const wchar_t *message) {
  MessageBoxW(NULL, message, L"DSH Desktop Portable", MB_OK | MB_ICONERROR);
  return 1;
}

static int bind_path(const wchar_t *name, const wchar_t *root, const wchar_t *suffix) {
  size_t n = wcslen(root) + wcslen(suffix) + 2;
  wchar_t *value = (wchar_t *)calloc(n, sizeof(wchar_t));
  if (!value) return 0;
  swprintf(value, n, L"%ls\\%ls", root, suffix);
  int ok = SetEnvironmentVariableW(name, value);
  free(value);
  return ok;
}

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE previous, PWSTR cmdline, int show) {
  (void)instance; (void)previous; (void)cmdline; (void)show;
  wchar_t path[32768];
  DWORD length = GetModuleFileNameW(NULL, path, 32768);
  if (!length || length >= 32768) return fail(L"Cannot locate the Portable launcher.");
  wchar_t *last = wcsrchr(path, L'\\');
  if (!last) return fail(L"Invalid Portable launcher path.");
  *last = L'\0';
  const wchar_t *root = path;
  if (!SetEnvironmentVariableW(L"DSH_PORTABLE_ROOT", root) ||
      !bind_path(L"DSH_PORTABLE_APP_DATA", root, L"AppData") ||
      !bind_path(L"DSH_HOME", root, L"AppData\\dsh-home") ||
      !bind_path(L"APPDATA", root, L"AppData") ||
      !bind_path(L"LOCALAPPDATA", root, L"AppData") ||
      !bind_path(L"TEMP", root, L"AppData\\temp") ||
      !bind_path(L"TMP", root, L"AppData\\temp") ||
      !bind_path(L"TMPDIR", root, L"AppData\\temp") ||
      !bind_path(L"PNPM_HOME", root, L"AppData\\pnpm-home") ||
      !bind_path(L"npm_config_cache", root, L"AppData\\npm-cache") ||
      !bind_path(L"npm_config_store_dir", root, L"AppData\\pnpm-store")) return fail(L"Cannot set Portable paths.");
  size_t size = wcslen(root) + wcslen(L"\\App\\DeepSeek Harness.exe") + 1;
  wchar_t *exe = (wchar_t *)calloc(size, sizeof(wchar_t));
  if (!exe) return fail(L"Out of memory.");
  swprintf(exe, size, L"%ls\\App\\DeepSeek Harness.exe", root);
  const wchar_t *raw = GetCommandLineW();
  const wchar_t *args = raw;
  if (*args == L'"') {
    ++args;
    while (*args && *args != L'"') ++args;
    if (*args) ++args;
  } else {
    while (*args && *args != L' ' && *args != L'\t') ++args;
  }
  size_t commandSize = wcslen(exe) + wcslen(args) + 3;
  wchar_t *command = (wchar_t *)calloc(commandSize, sizeof(wchar_t));
  if (!command) { free(exe); return fail(L"Out of memory."); }
  swprintf(command, commandSize, L"\"%ls\"%ls", exe, args);
  STARTUPINFOW startup = {0}; startup.cb = sizeof(startup);
  PROCESS_INFORMATION child = {0};
  BOOL started = CreateProcessW(exe, command, NULL, NULL, FALSE, 0, NULL, NULL, &startup, &child);
  free(command); free(exe);
  if (!started) return fail(L"Cannot start App\\DeepSeek Harness.exe. Extract the complete ZIP first.");
  CloseHandle(child.hThread);
  WaitForSingleObject(child.hProcess, INFINITE);
  DWORD code = 1;
  GetExitCodeProcess(child.hProcess, &code);
  CloseHandle(child.hProcess);
  return (int)code;
}
