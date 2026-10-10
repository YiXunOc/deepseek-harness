#!/usr/bin/env python3
"""Verify an unsigned local Windows Portable ZIP against its assembled tree."""
import hashlib
import json
import pathlib
import subprocess
import struct
import sys
import zipfile


def pe_machine(path: pathlib.Path) -> int:
    with path.open('rb') as stream:
        header = stream.read(64)
        if header[:2] != b'MZ' or len(header) < 64:
            raise ValueError(f'not a PE file: {path}')
        stream.seek(struct.unpack_from('<I', header, 60)[0])
        coff = stream.read(6)
        if coff[:4] != b'PE\0\0':
            raise ValueError(f'invalid PE signature: {path}')
        return struct.unpack_from('<H', coff, 4)[0]


def verify(tree: pathlib.Path, archive: pathlib.Path) -> None:
    assert tree.is_dir() and archive.is_file(), 'missing Portable tree or ZIP'
    expected_files = {p.relative_to(tree).as_posix(): p for p in tree.rglob('*') if p.is_file()}
    if any(p.is_symlink() for p in tree.rglob('*')):
        raise ValueError('symlink in Portable tree')
    for name in ['DSH Desktop Portable.exe', 'App/DeepSeek Harness.exe',
                 'App/resources/app.asar', 'App/resources/runtime/primary-runtime/runtime.json',
                 'App/resources/app.asar.unpacked/dsh/node_modules/node-pty/prebuilds/win32-x64/conpty.node',
                 'App/resources/app.asar.unpacked/dsh/node_modules/@deepseek-ai/dsh-desktop-host/node_modules/@koromix/koffi-win32-x64/win32_x64/koffi.node']:
        if name not in expected_files:
            raise ValueError(f'missing Portable entry: {name}')
    if 'DeepSeek Harness.exe' in expected_files or 'DSH Desktop Portable.cmd' in expected_files:
        raise ValueError('bypassing root executable')
    for name in ['DSH Desktop Portable.exe', 'App/DeepSeek Harness.exe',
                 'App/resources/runtime/primary-runtime/dependencies/node/bin/node.exe',
                 'App/resources/app.asar.unpacked/dsh/node_modules/node-pty/prebuilds/win32-x64/conpty.node',
                 'App/resources/app.asar.unpacked/dsh/node_modules/@deepseek-ai/dsh-desktop-host/node_modules/@koromix/koffi-win32-x64/win32_x64/koffi.node']:
        if pe_machine(expected_files[name]) != 0x8664:
            raise ValueError(f'not Windows x64 PE: {name}')
    layout = json.loads(expected_files['AppData/layout.json'].read_text())
    if layout.get('root') != '.' or layout.get('appData') != 'AppData':
        raise ValueError('non-relocatable AppData layout')
    build = json.loads(expected_files['portable-build.json'].read_text())
    runtime = json.loads(expected_files['App/resources/runtime/primary-runtime/runtime.json'].read_text())
    if build.get('version') != runtime.get('desktopVersion') or runtime.get('platform') != 'win32' or runtime.get('arch') != 'x64':
        raise ValueError('Portable runtime provenance mismatch')
    repo = pathlib.Path(__file__).resolve().parents[3]
    probe = subprocess.run(['node', '-e',
        'const a=require("@electron/asar");const m=JSON.parse(a.extractFile(process.argv[1],"package.json").toString());'
        'if(!m.main||!a.extractFile(process.argv[1],m.main).length)process.exit(2);'
        'console.log(JSON.stringify({version:m.version,commit:m.dshBuildCommit,dirty:m.dshBuildDirty,'
        'local:m.dshPortableLocalTestNoPolicy,policy:m.dshMandatoryUpdatePolicy}));',
        str(expected_files['App/resources/app.asar'])], cwd=repo, capture_output=True, text=True, check=True)
    manifest = json.loads(probe.stdout.strip())
    if (manifest.get('version') != build.get('version') or manifest.get('commit') != build.get('commit')
            or manifest.get('dirty') is not False or manifest.get('local') is not True
            or manifest.get('policy') is not None):
        raise ValueError('ASAR version, commit, clean-state or unsigned local-test marker mismatch')
    with zipfile.ZipFile(archive) as zf:
        if zf.testzip() is not None:
            raise ValueError('ZIP CRC failure')
        prefix = tree.name + '/'
        actual = {item.filename[len(prefix):]: item for item in zf.infolist() if item.filename.startswith(prefix) and not item.is_dir()}
        if actual.keys() != expected_files.keys():
            raise ValueError(f'ZIP content mismatch: expected {len(expected_files)} got {len(actual)}')
        for name, path in expected_files.items():
            sha = hashlib.sha256()
            with zf.open(actual[name]) as src:
                while data := src.read(1024 * 1024):
                    sha.update(data)
            if actual[name].file_size != path.stat().st_size:
                raise ValueError(f'ZIP size mismatch: {name}')
            with path.open('rb') as local:
                local_sha = hashlib.file_digest(local, 'sha256').digest()
            if sha.digest() != local_sha:
                raise ValueError(f'ZIP bytes mismatch: {name}')
    sidecar = archive.with_name(archive.name + '.sha256')
    expected = sidecar.read_text().split()[0]
    with archive.open('rb') as stream:
        if hashlib.file_digest(stream, 'sha256').hexdigest() != expected:
            raise ValueError('ZIP SHA-256 mismatch')
    print(f'VERIFIED files={len(expected_files)} bytes={archive.stat().st_size} sha256={expected} version={build.get("version")} commit={build.get("commit")}')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('usage: verify-cross-portable.py <assembled-root> <zip>')
    verify(pathlib.Path(sys.argv[1]).resolve(), pathlib.Path(sys.argv[2]).resolve())
