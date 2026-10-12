#!/usr/bin/env python3
"""Check that the Windows launcher embeds the Desktop application ICO images."""
import collections
import pathlib
import struct
import sys


def ico_images(data):
    assert struct.unpack_from('<HHH', data)[:2] == (0, 1), 'not an ICO'
    count = struct.unpack_from('<H', data, 4)[0]
    assert count > 0, 'empty ICO'
    return collections.Counter(data[struct.unpack_from('<I', data, 6 + n * 16 + 12)[0]:
                                    struct.unpack_from('<I', data, 6 + n * 16 + 12)[0] +
                                    struct.unpack_from('<I', data, 6 + n * 16 + 8)[0]]
                               for n in range(count))


def pe_icon_images(data):
    assert data[:2] == b'MZ', 'not a PE executable'
    pe = struct.unpack_from('<I', data, 60)[0]
    assert data[pe:pe + 4] == b'PE\0\0', 'not a PE executable'
    optional = pe + 24
    magic = struct.unpack_from('<H', data, optional)[0]
    assert magic in (0x10b, 0x20b), 'unsupported PE optional header'
    directory = optional + (112 if magic == 0x20b else 96)
    root_rva = struct.unpack_from('<I', data, directory + 16)[0]
    assert root_rva, 'launcher has no Windows resources'
    sections = []
    at = optional + struct.unpack_from('<H', data, pe + 20)[0]
    for n in range(struct.unpack_from('<H', data, pe + 6)[0]):
        size, virtual, raw_size, raw = struct.unpack_from('<IIII', data, at + n * 40 + 8)
        sections.append((virtual, max(size, raw_size), raw))

    def file_offset(rva):
        for virtual, size, raw in sections:
            if virtual <= rva < virtual + size:
                return raw + rva - virtual
        raise ValueError(f'PE resource RVA missing: {rva}')

    root = file_offset(root_rva)

    def entries(relative):
        offset = root + relative
        named, numbered = struct.unpack_from('<HH', data, offset + 12)
        return [struct.unpack_from('<II', data, offset + 16 + n * 8)
                for n in range(named + numbered)]

    def leaves(kind):
        match = [target for name, target in entries(0) if name == kind]
        assert len(match) == 1 and match[0] & 0x80000000, f'icon resource {kind} missing'
        result = {}
        for name, target in entries(match[0] & 0x7fffffff):
            assert not name & 0x80000000 and target & 0x80000000, 'unexpected icon directory'
            languages = entries(target & 0x7fffffff)
            assert languages, 'missing icon language'
            entry = languages[0][1]
            assert not entry & 0x80000000, 'unexpected icon data entry'
            rva, size = struct.unpack_from('<II', data, root + entry)
            offset = file_offset(rva)
            result[name] = data[offset:offset + size]
        return result

    icons = leaves(3)
    groups = leaves(14)
    assert len(groups) == 1, 'expected one launcher icon group'
    group = next(iter(groups.values()))
    reserved, kind, count = struct.unpack_from('<HHH', group)
    assert (reserved, kind) == (0, 1) and count > 0, 'invalid launcher icon group'
    images = []
    for n in range(count):
        size, icon_id = struct.unpack_from('<IH', group, 6 + n * 14 + 8)
        assert icon_id in icons and len(icons[icon_id]) == size, 'launcher icon image missing'
        images.append(icons[icon_id])
    return collections.Counter(images)


if __name__ == '__main__':
    exe, icon = (pathlib.Path(value) for value in sys.argv[1:])
    expected = ico_images(icon.read_bytes())
    assert pe_icon_images(exe.read_bytes()) == expected, 'launcher icon differs from Desktop icon source'
    print(f'Launcher icon verified: {sum(expected.values())} embedded images')
