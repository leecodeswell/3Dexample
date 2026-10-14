"""Optional non-destructive Blender preparation, not needed by the web showcase.

blender -b --factory-startup --python-exit-code 1 --python tools/prepare_blender.py -- \
  --output /workspace/scratch/watch-prepared.blend

Imports the source, separates its existing case/dial material regions, and
organizes native component collections. Never overwrites or re-exports the GLB.
No gears, movement, link articulation, or fabricated geometry is generated.
"""
import argparse
import json
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[1]
ROLES = {
    'Cylinder': 'case', 'Cylinder.003': 'crown', 'Cube.004': 'case',
    'Cube.006': 'bracelet', 'Cylinder.006': 'spring_bars',
    'Cube.005': 'clasp', 'Cube.008': 'clasp', 'glass': 'glass',
    'Text': 'dial', 'Text.001': 'dial', 'Text.002': 'dial', 'Text.003': 'dial',
    'Text.004': 'dial', 'Text.005': 'dial', 'Plane': 'dial', 'Curve': 'dial',
    'Cylinder.004': 'hub', 'Cone': 'hub',
    'Cube.002': 'second_hand', 'Cube': 'hour_hand', 'Cube.001': 'minute_hand',
}
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', type=Path, default=ROOT / 'mechanical watch.glb')
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
if args.output.suffix.lower() != '.blend' or args.output.resolve() == args.source.resolve():
    raise ValueError('Output must be a distinct .blend file')
if args.output.exists():
    raise FileExistsError(f'Refusing to overwrite existing output: {args.output}')
args.output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(args.source.resolve()))
objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
if len(objects) != 21:
    raise ValueError(f'Expected original 21 mesh objects, found {len(objects)}')
for obj in objects:
    if obj.name not in ROLES:
        raise ValueError(f'Unexpected source name {obj.name}; inspect before preparing')
    obj['watch_component'] = ROLES[obj.name]
    obj['source_node_name'] = obj.name
case = next(o for o in objects if {'body', 'digit place'} <= {m.name for m in o.data.materials})
original_faces = sum(len(o.data.polygons) for o in objects)
bpy.ops.object.select_all(action='DESELECT')
case.select_set(True)
bpy.context.view_layer.objects.active = case
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.separate(type='MATERIAL')
bpy.ops.object.mode_set(mode='OBJECT')
for obj in bpy.context.selected_objects:
    if {m.name for m in obj.data.materials} == {'digit place'}:
        obj['watch_component'] = 'dial'
        obj.name = 'Dial_Surface'
    else:
        obj['watch_component'] = 'case'
objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
if sum(len(o.data.polygons) for o in objects) != original_faces:
    raise AssertionError('Material separation changed polygon count')
collections = {}
for obj in objects:
    role = obj['watch_component']
    if role not in collections:
        collection = bpy.data.collections.new('Watch / ' + role)
        bpy.context.scene.collection.children.link(collection)
        collections[role] = collection
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    collections[role].objects.link(obj)
bpy.context.scene['preparation_notes'] = 'Original shapes/materials retained. No movement or gears exist. Bracelet links remain joined. Source GLB unchanged.'
bpy.ops.wm.save_as_mainfile(filepath=str(args.output.resolve()))
print('PREPARED_WATCH', json.dumps({'objects': len(objects), 'polygons': original_faces, 'components': list(collections), 'output': str(args.output)}))
