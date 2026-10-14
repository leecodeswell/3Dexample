#!/usr/bin/env python3
"""Inventory GLB nodes, primitives, materials, transforms, and independent parts.
No Blender or third-party libraries required. Does not modify the model.
"""
import argparse
import hashlib
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = json.loads((ROOT / 'src/model-config.json').read_text())


def inspect(path, source=None):
    source = source or next((s for s in CONFIG['sources'] if Path(s['asset']).name == path.name), {'memberships': {}})
    categories = {i: (role, 'Selected hybrid mesh grouped as ' + role) for role, nodes in source['memberships'].items() for i in nodes}
    blob = path.read_bytes()
    magic, version, length = struct.unpack_from('<4sII', blob)
    if magic != b'glTF' or version != 2 or length != len(blob):
        raise ValueError('Invalid GLB 2.0 header')
    cursor, chunks = 12, []
    while cursor < length:
        size, kind = struct.unpack_from('<II', blob, cursor)
        cursor += 8
        if size % 4 or cursor + size > length:
            raise ValueError('Invalid GLB chunk boundary')
        chunks.append((kind, blob[cursor:cursor + size]))
        cursor += size
    if cursor != length or chunks[0][0] != 0x4E4F534A:
        raise ValueError('Missing GLB JSON chunk')
    document = json.loads(chunks[0][1])
    binary = next(data for kind, data in chunks if kind == 0x004E4942)
    for buffer in document.get('buffers', []):
        if 'uri' not in buffer and buffer['byteLength'] > len(binary):
            raise ValueError('Buffer exceeds BIN chunk')
    parents = {}
    for i, node in enumerate(document['nodes']):
        for child in node.get('children', []):
            parents[child] = i
    inventory = []
    for index, node in enumerate(document['nodes']):
        primitives = []
        mesh = document['meshes'][node['mesh']] if 'mesh' in node else None
        for pi, primitive in enumerate(mesh.get('primitives', []) if mesh else []):
            accessor = document['accessors'][primitive['attributes']['POSITION']]
            primitives.append({
                'primitive_index': pi,
                'material': document['materials'][primitive['material']]['name'],
                'vertex_count': accessor['count'],
                'triangle_count': document['accessors'][primitive['indices']]['count'] // 3 if 'indices' in primitive else accessor['count'] // 3,
                'local_bounds': {'min': accessor.get('min'), 'max': accessor.get('max')},
            })
        role, notes = categories.get(index, ('excluded' if mesh else 'assembly', 'Unused source mesh' if mesh else 'Authored hierarchy/container transform'))
        if node.get('extras', {}).get('watch_component'):
            role = node['extras']['watch_component']; notes = 'Baked display derivative'
            source['memberships'].setdefault(role, []).append(index)
        inventory.append({
            'node_index': index, 'name': node.get('name'), 'parent_node': parents.get(index),
            'children': node.get('children', []), 'mesh_index': node.get('mesh'),
            'translation': node.get('translation', [0, 0, 0]),
            'rotation_quaternion': node.get('rotation', [0, 0, 0, 1]),
            'scale': node.get('scale', [1, 1, 1]), 'matrix': node.get('matrix'),
            'role': role, 'notes': notes, 'primitives': primitives, 'extras': node.get('extras', {}),
        })
    return {
        'source': path.name, 'sha256': hashlib.sha256(blob).hexdigest(), 'bytes': len(blob),
        'asset': document['asset'], 'scene_roots': document['scenes'][document.get('scene', 0)].get('nodes', []),
        'node_count': len(document['nodes']), 'mesh_count': len(document['meshes']),
        'primitive_count': sum(len(n['primitives']) for n in inventory),
        'materials': document['materials'], 'images': document.get('images', []),
        'logical_components': source['memberships'],
        'external_resources': [item['uri'] for key in ('buffers', 'images') for item in document.get(key, []) if 'uri' in item and not item['uri'].startswith('data:')],
        'animations': len(document.get('animations', [])), 'skins': len(document.get('skins', [])),
        'nodes': inventory,
        'selected_mesh_count': sum(len(v) for v in source['memberships'].values()),
        'limitations': ['Hybrid is a designed combination of two models, not a certified physical mechanism.',
                         'Uploads are preserved. Display derivative adds bevels, a dial and replacement hands; runtime poses are reversible.'],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('asset', nargs='?', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    report = inspect(args.asset) if args.asset else {'raw_preparation_mesh_count': CONFIG['selectedMeshCount'], 'display_mesh_count': CONFIG['derived']['meshCount'], 'component_count': len(CONFIG['derived']['components']), 'sources': [inspect(ROOT / 'public' / s['asset'].lstrip('/'), s) for s in CONFIG['sources']], 'derivative': inspect(ROOT / 'public' / CONFIG['derived']['asset'].lstrip('/')), 'face_depths': json.loads((ROOT / 'docs/face-depths.json').read_text())}
    result = json.dumps(report, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(result + '\n')
        print(f'Inventory saved to {args.output}')
    else:
        print(result)


if __name__ == '__main__':
    main()
