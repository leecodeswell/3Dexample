"""Prepare the actual hybrid assembly for further Blender authoring.
blender -b --factory-startup --python-exit-code 1 --python tools/prepare_blender.py -- \
  --output /workspace/scratch/hybrid-watch-prepared.blend
Original GLBs remain unchanged. The web app supplies poses and studio materials.
"""
import argparse
import json
import sys
from pathlib import Path
import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
config = json.loads((ROOT / 'src/model-config.json').read_text())
inventory = json.loads((ROOT / 'docs/model-inventory.json').read_text())
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
if args.output.suffix.lower() != '.blend' or args.output.exists():
    raise ValueError('Choose a new .blend output; existing files will not be overwritten.')
args.output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
collections = {}; selected = []
for source, report in zip(config['sources'], inventory['sources']):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / 'public' / source['asset'].lstrip('/')))
    imported_objects = [o for o in bpy.data.objects if o not in before]
    imported = [o for o in imported_objects if o.type == 'MESH']
    assert len(imported) == source['sourceMeshCount']
    roles = {report['nodes'][i]['name']: role for role, indices in source['memberships'].items() for i in indices}
    center = Vector(source['center']); center = Vector((center.x, -center.z, center.y))
    transform = Matrix.Translation(-center * source['scale']) @ Matrix.Scale(source['scale'], 4)
    matrices = {obj: obj.matrix_world.copy() for obj in imported}
    mount = bpy.data.objects.new('Hybrid source / ' + source['id'], None)
    bpy.context.scene.collection.objects.link(mount); mount.matrix_world = transform
    # Retain authored parent chains and their nonuniform scales. Flattening through
    # TRS would lose shear, so normalization is applied to a new uniform root only.
    for root in [o for o in imported_objects if o.parent is None]:
        basis = root.matrix_basis.copy(); root.parent = mount
        root.matrix_parent_inverse = Matrix.Identity(4); root.matrix_basis = basis
    bpy.context.view_layer.update()
    for obj in imported:
        name = obj.name if obj.name in roles else obj.name.rsplit('.', 1)[0]
        if name not in roles:
            bpy.data.objects.remove(obj, do_unlink=True); continue
        role = roles[name]
        expected = transform @ matrices[obj]
        assert max(abs(obj.matrix_world[r][c] - expected[r][c]) for r in range(4) for c in range(4)) < 1e-4
        obj['watch_component'] = role; obj['watch_source'] = source['id']; selected.append(obj)
        if role not in collections:
            collection = bpy.data.collections.new('Hybrid / ' + role)
            bpy.context.scene.collection.children.link(collection); collections[role] = collection
        for collection in list(obj.users_collection): collection.objects.unlink(obj)
        collections[role].objects.link(obj)
assert len(selected) == config['selectedMeshCount']
bpy.context.scene['source_credits'] = 'Exterior: DevPoly3D; mechanism: abdelghani.0. Both CC BY 4.0. Hybrid assembly and display finishes modified.'
bpy.ops.wm.save_as_mainfile(filepath=str(args.output.resolve()))
print('PREPARED_HYBRID', json.dumps({'objects': len(selected), 'polygons': sum(len(o.data.polygons) for o in selected), 'components': list(collections), 'output': str(args.output)}))
