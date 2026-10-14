#!/usr/bin/env python3
"""Inventory GLB nodes, primitives, materials, transforms, and independent parts.
No Blender or third-party libraries required. Does not modify the model.
"""
import argparse
import hashlib
import json
import struct
from pathlib import Path

CATEGORIES = {
    0: ('case_and_dial', 'Two existing material primitives: body and dial surface; separable at runtime.'),
    1: ('crown', 'Independent crown mesh.'),
    2: ('case_frame', 'Independent outer case / lug frame.'),
    3: ('bracelet', 'Joined bracelet mesh. Links are not independent scene nodes.'),
    4: ('spring_bars', 'Two spring bars joined into one mesh; move together.'),
    5: ('clasp', 'Independent clasp plate.'),
    6: ('clasp_detail', 'Independent clasp pin/detail; grouped with clasp.'),
    7: ('glass', 'Independent glass shell; exported alphaMode BLEND with alpha 1.'),
    8: ('dial_numeral', 'Keep attached to dial surface.'),
    9: ('dial_numeral', 'Keep attached to dial surface.'),
    10: ('dial_numeral', 'Keep attached to dial surface.'),
    11: ('dial_numeral', 'Keep attached to dial surface.'),
    12: ('dial_inscription', 'Keep attached to dial surface.'),
    13: ('dial_inscription', 'Keep attached to dial surface.'),
    14: ('dial_indices', 'Indices with luminous inlays; keep attached to dial.'),
    15: ('dial_emblem', 'Keep attached to dial surface.'),
    16: ('hand_hub', 'Independent central hub.'),
    17: ('hand_cap', 'Independent central cap.'),
    18: ('second_hand', 'Thin diagonal hand; independent transform.'),
    19: ('hour_hand', 'Short luminous hand; independent transform.'),
    20: ('minute_hand', 'Long luminous hand; independent transform.'),
}


def inspect(path):
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
        role, notes = CATEGORIES.get(index, ('unknown', 'Needs inspection'))
        inventory.append({
            'node_index': index, 'name': node.get('name'), 'parent_node': parents.get(index),
            'children': node.get('children', []), 'mesh_index': node.get('mesh'),
            'translation': node.get('translation', [0, 0, 0]),
            'rotation_quaternion': node.get('rotation', [0, 0, 0, 1]),
            'scale': node.get('scale', [1, 1, 1]), 'matrix': node.get('matrix'),
            'role': role, 'notes': notes, 'primitives': primitives,
        })
    return {
        'source': path.name, 'sha256': hashlib.sha256(blob).hexdigest(), 'bytes': len(blob),
        'asset': document['asset'], 'scene_roots': document['scenes'][document.get('scene', 0)].get('nodes', []),
        'node_count': len(document['nodes']), 'mesh_count': len(document['meshes']),
        'primitive_count': sum(len(n['primitives']) for n in inventory),
        'materials': document['materials'],
        'external_resources': [item['uri'] for key in ('buffers', 'images') for item in document.get(key, []) if 'uri' in item and not item['uri'].startswith('data:')],
        'animations': len(document.get('animations', [])), 'skins': len(document.get('skins', [])),
        'nodes': inventory,
        'limitations': ['No mechanical movement, gears, escapement, or independently modeled caseback are present.',
                        'Bracelet links and paired spring bars are joined; runtime animation treats each mesh as one component.',
                        'Glass is geometrically independent but its original material exports alpha=1. Optional studio material is a runtime override.'],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('asset', nargs='?', type=Path, default=Path(__file__).resolve().parents[1] / 'mechanical watch.glb')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    result = json.dumps(inspect(args.asset), indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(result + '\n')
        print(f'Inventory saved to {args.output}')
    else:
        print(result)


if __name__ == '__main__':
    main()
