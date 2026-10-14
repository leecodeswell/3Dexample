"""Refine only the active crystal, preserving every other component's world bounds.
blender -b --factory-startup --python-exit-code 1 --python tools/refine_crystal.py -- \
  --output /tmp/watch-crystal-refined.glb
Writes a separate reviewable output. Copy it over the active GLB after validation.
"""
import argparse,json,math,sys
from collections import Counter
from pathlib import Path
import bpy
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[1]
config=json.loads((ROOT/'src/model-config.json').read_text())['model']
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
active=ROOT/'public'/config['asset'].lstrip('/')
if args.output.resolve()==active.resolve() or args.output.exists():raise ValueError('Use a new output path for review.')
args.output.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(active))
objects=[o for o in bpy.data.objects if o.type=='MESH'];assert len(objects)==config['meshCount']
def bounds(o):
 points=[o.matrix_world@v.co for v in o.data.vertices]
 return [[min(p[a] for p in points) for a in range(3)],[max(p[a] for p in points) for a in range(3)]]
before={o.name:bounds(o) for o in objects}
glass=next(o for o in objects if o.get('watch_component')=='glass')
# All distances are normalized glTF watch units. Hands end at z=.116.
# Inner crystal z >= .129; front center .167. Neither refraction nor geometry
# requires an artificial alpha fade to reveal the readable face.
radius=.879;segments=128;rings=20;thickness=.016;sag=.022;rim=.145
vertices=[];normals=[];uv=[];faces=[]
def add(x,y,z,n):
 vertices.append((x,-z,y));normals.append((n[0],-n[2],n[1]));uv.append((.5+x/(2*radius),.5+y/(2*radius)))
for side in [1,-1]:
 start=len(vertices);z=rim+sag-(thickness if side<0 else 0);add(0,0,z,(0,0,side))
 for k in range(1,rings+1):
  r=radius*k/rings
  for i in range(segments):
   a=i*math.tau/segments;x=r*math.cos(a);y=r*math.sin(a);z=rim+sag*(1-(r/radius)**2)-(thickness if side<0 else 0)
   n=Vector((2*sag*x/radius**2,2*sag*y/radius**2,1)).normalized()*side;add(x,y,z,n)
 for i in range(segments):
  j=(i+1)%segments;face=(start,start+1+i,start+1+j);faces.append(face if side>0 else tuple(reversed(face)))
 for k in range(1,rings):
  inner=start+1+(k-1)*segments;outer=inner+segments
  for i in range(segments):
   j=(i+1)%segments;face=(inner+i,outer+i,outer+j,inner+j);faces.append(face if side>0 else tuple(reversed(face)))
# Independent rim vertices keep the optical face normals continuous and shallow.
start=len(vertices)
for z in [rim,rim-thickness]:
 for i in range(segments):
  a=i*math.tau/segments;add(radius*math.cos(a),radius*math.sin(a),z,(math.cos(a),math.sin(a),0))
for i in range(segments):
 j=(i+1)%segments;faces.append((start+i,start+segments+i,start+segments+j,start+j))
mesh=bpy.data.meshes.new('Shallow polished sapphire crystal');mesh.from_pydata(vertices,[],faces);mesh.update()
for m in glass.data.materials:mesh.materials.append(m)
layer=mesh.uv_layers.new(name='Crystal UV')
for polygon in mesh.polygons:
 polygon.use_smooth=True
 for loop in polygon.loop_indices:layer.data[loop].uv=uv[mesh.loops[loop].vertex_index]
mesh.normals_split_custom_set_from_vertices(normals)
glass.parent=None;glass.matrix_world=Matrix.Identity(4);glass.data=mesh
glass['crystal_profile']='shallow_sapphire';glass['crystal_thickness']=thickness;glass['crystal_sag']=sag
bpy.context.view_layer.update()
for o in objects:
 if o!=glass:assert max(abs(a-b) for va,vb in zip(before[o.name],bounds(o)) for a,b in zip(va,vb))<1e-6,o.name
roles=Counter(o['watch_component'] for o in objects);assert dict(roles)==config['components']
depths={}
for o in objects:
 values=[-(o.matrix_world@v.co).y for v in o.data.vertices];role=o['watch_component'];lo,hi=depths.get(role,[float('inf'),-float('inf')]);depths[role]=[min(lo,min(values)),max(hi,max(values))]
assert depths['glass'][0]>max(depths[k][1] for k in ['hour','minute','second','hub'])
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=glass
options=dict(filepath=str(args.output),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_extras=True,export_yup=True,export_normals=True,export_texcoords=True,export_materials='EXPORT')
if 'export_copyright' in bpy.ops.export_scene.gltf.get_rna_type().properties:options['export_copyright']='Exterior by DevPoly3D; mechanism by abdelghani.0; CC BY 4.0. Modified hybrid, dial, hands and sapphire crystal.'
bpy.ops.export_scene.gltf(**options)
args.output.with_suffix('.depths.json').write_text(json.dumps(depths,indent=2)+'\n')
print('REFINED_CRYSTAL',args.output,'unchanged other meshes',len(objects)-1,'crystal depths',depths['glass'])
