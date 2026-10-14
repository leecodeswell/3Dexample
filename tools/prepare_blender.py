"""Organize the replacement watch in component collections without editing geometry.
blender -b --factory-startup --python-exit-code 1 --python tools/prepare_blender.py -- \
  --output /workspace/scratch/luxury-watch-prepared.blend
The web app handles brown colors and cinematic finishes at runtime.
"""
import argparse
import json
import sys
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[1]
config = json.loads((ROOT / 'src/model-config.json').read_text())
inventory = json.loads((ROOT / 'docs/model-inventory.json').read_text())
roles = {inventory['nodes'][i]['name']: role for role, indices in config['memberships'].items() for i in indices}
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', type=Path, default=ROOT / 'public' / config['asset'].lstrip('/'))
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
if args.output.suffix.lower() != '.blend' or args.output.resolve() == args.source.resolve():
    raise ValueError('Output must be a distinct .blend file')
if args.output.exists():
    raise FileExistsError(f'Refusing to overwrite existing output: {args.output}')
args.output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(args.source.resolve()))
objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
assert len(objects) == config['meshCount']
collections = {}
for obj in objects:
    if obj.name not in roles:
        raise ValueError(f'Unexpected mesh name: {obj.name}')
    role = roles[obj.name]; obj['watch_component'] = role; obj['source_node_name'] = obj.name
    if role not in collections:
        collection = bpy.data.collections.new('Watch / ' + role)
        bpy.context.scene.collection.children.link(collection); collections[role] = collection
    # Keep authored parent transforms; only collection membership changes.
    for collection in list(obj.users_collection): collection.objects.unlink(obj)
    collections[role].objects.link(obj)
bpy.context.scene['source_credit'] = 'Watch – Luxury Wristwatch 3D Model by DevPoly3D, CC BY 4.0'
bpy.ops.wm.save_as_mainfile(filepath=str(args.output.resolve()))
print('PREPARED_WATCH', json.dumps({'objects': len(objects), 'polygons': sum(len(o.data.polygons) for o in objects), 'components': list(collections), 'output': str(args.output)}))
