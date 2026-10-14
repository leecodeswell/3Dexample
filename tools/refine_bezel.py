"""Give the inspected city-letter bezel a clean enamel finish without remeshing.

python3 tools/refine_bezel.py --output /tmp/watch-clean-bezel.glb
Only the bezel/rim material references and crystal pivot metadata change. All
binary geometry, UVs, embedded source images and other materials are preserved.
"""
import argparse
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
source = ROOT / 'public/watch-photoreal.glb'
assert args.output.resolve() != source.resolve(), 'Write a separate reviewable asset.'
assert not args.output.exists(), 'Output already exists.'
data = source.read_bytes()
length, kind = struct.unpack_from('<II', data, 12)
assert kind == 0x4E4F534A
model = json.loads(data[20:20 + length])
assert len(model['meshes']) == 110
bezel = next(node for node in model['nodes'] if node['name'] == 'photo_exterior_case_029')
primitives = model['meshes'][bezel['mesh']]['primitives']
assert len(primitives) == 1
assert model['materials'][primitives[0]['material']]['name'] in ['Image', 'Bezel_enamel']
color = [int(channel, 16) / 255 for channel in ['10', '12', '14']]
linear = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in color]
enamel = {
    'name': 'Bezel_enamel',
    'doubleSided': True,
    'pbrMetallicRoughness': {'baseColorFactor': [*linear, 1], 'metallicFactor': .18, 'roughnessFactor': .21},
    'extensions': {'KHR_materials_clearcoat': {'clearcoatFactor': .7, 'clearcoatRoughnessFactor': .08}},
}
def assign_material(primitive, material):
    names = [m['name'] for m in model['materials']]
    if material['name'] not in names:
        model['materials'].append(material)
        names.append(material['name'])
    primitive['material'] = names.index(material['name'])
assign_material(primitives[0], enamel)
# The thin outer lip samples another band of the same city-letter atlas.
# Give it its own untextured polished steel, retaining the source bevels.
rim = next(node for node in model['nodes'] if node['name'] == 'photo_exterior_case_017')
rim_primitive = model['meshes'][rim['mesh']]['primitives'][0]
assert model['materials'][rim_primitive['material']]['name'] in ['Image', 'Metal_bezel_rim']
assign_material(rim_primitive, {
    'name': 'Metal_bezel_rim', 'doubleSided': True,
    'pbrMetallicRoughness': {'baseColorFactor': [.552, .578, .597, 1], 'metallicFactor': 1, 'roughnessFactor': .19},
})
used = model.setdefault('extensionsUsed', [])
if 'KHR_materials_clearcoat' not in used:
    used.append('KHR_materials_clearcoat')
bezel['extras']['bezel_finish'] = 'Unlettered polished dark enamel; source geometry retained.'
crystal = next(node for node in model['nodes'] if node.get('extras', {}).get('watch_component') == 'glass')
crystal['extras']['watch_pivot'] = [0, 0, .148]
notice = ' City-letter bezel replaced with unlettered enamel.'
if notice not in model['asset']['copyright']:
    model['asset']['copyright'] += notice
encoded = json.dumps(model, separators=(',', ':')).encode()
encoded += b' ' * (-len(encoded) % 4)
binary_chunk = data[20 + length:]
result = struct.pack('<III', 0x46546C67, 2, 20 + len(encoded) + len(binary_chunk))
result += struct.pack('<II', len(encoded), kind) + encoded + binary_chunk
assert result[20 + len(encoded):] == data[20 + length:]
args.output.write_bytes(result)
print(f'Wrote {args.output}: 110 meshes, all binary data unchanged, clean enamel bezel and steel rim.')
