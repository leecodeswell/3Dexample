"""Open the single active watch in Blender and organize its inspected components.
blender -b --factory-startup --python-exit-code 1 --python tools/prepare_blender.py -- \
  --output /workspace/scratch/watch-studio.blend
The checked-in GLB is not modified. Legacy uploads are no longer required.
"""
import argparse,json,sys
from pathlib import Path
import bpy
ROOT=Path(__file__).resolve().parents[1]
config=json.loads((ROOT/'src/model-config.json').read_text())['model']
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
if args.output.suffix.lower()!='.blend' or args.output.exists():
 raise ValueError('Choose a new .blend output; existing files will not be overwritten.')
args.output.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public'/config['asset'].lstrip('/')))
objects=[o for o in bpy.data.objects if o.type=='MESH'];groups={}
assert len(objects)==config['meshCount']
for o in objects:
 role=o.get('watch_component');assert role in config['components'],o.name
 if role not in groups:
  c=bpy.data.collections.new('Watch / '+role);bpy.context.scene.collection.children.link(c);groups[role]=c
 for c in list(o.users_collection):c.objects.unlink(o)
 groups[role].objects.link(o)
assert {role:len(c.objects) for role,c in groups.items()}==config['components']
bpy.context.scene['source_credits']='Exterior: DevPoly3D; mechanism: abdelghani.0; CC BY 4.0. Combined geometry, dial/hands and presentation modified.'
bpy.ops.wm.save_as_mainfile(filepath=str(args.output.resolve()))
print('PREPARED_WATCH',json.dumps({'meshes':len(objects),'components':len(groups),'output':str(args.output)}))
