"""Bake a source-preserving photoreal display derivative with tiny bevels.
blender -b /workspace/scratch/hybrid-watch-preserved.blend --python-exit-code 1 \
  --python tools/refine_geometry.py
Run prepare_blender.py first if the input authoring .blend is unavailable.
"""
import bpy,json,math
from pathlib import Path
from mathutils import Matrix, Vector
ROOT=Path(__file__).resolve().parents[1]
objects=[o for o in bpy.data.objects if o.type=='MESH' and 'watch_component' in o]
assert len(objects)==101
# Replace the six legacy hand meshes: their source depth interpenetrates the movement.
legacy=[o for o in objects if o['watch_component'] in {'hour','minute','second','hub'}]
objects=[o for o in objects if o not in legacy]
for o in legacy:bpy.data.objects.remove(o,do_unlink=True)
bpy.context.view_layer.update()
pivots={}
for o in objects:
 role=o['watch_component']
 if role.startswith('gear') or (role=='tourbillon' and o.name.startswith('Tourbillon_1.')):
  p=o.parent.matrix_world.translation.copy()
  pivots[role]=[-p.x,-p.z,-p.y-.075]
# Cache all evaluated matrices first, before changing any parent relationships.
world={o:o.matrix_world.copy() for o in objects}
for o in objects:
 role=o['watch_component'];deps=bpy.context.evaluated_depsgraph_get()
 evaluated=o.evaluated_get(deps)
 mesh=bpy.data.meshes.new_from_object(evaluated,preserve_all_data_layers=True,depsgraph=deps)
 mesh.transform(world[o]);
 if o['watch_source']=='mechanism':
  # Turn the escapement to six o'clock, then recess it beneath the new dial.
  mesh.transform(Matrix.Translation((0,.075,0)) @ Matrix.Rotation(math.pi,4,'Y'))
 o.parent=None;o.matrix_world=Matrix.Identity(4);o.data=mesh;o.animation_data_clear()
 if role in pivots:o['watch_pivot']=pivots[role]
 o.name=f'photo_{o["watch_source"]}_{role}_{objects.index(o):03}'
 # Bevel width is in normalized watch units (~20 mm per unit).
 width=.0012 if role.startswith('gear') or role=='tourbillon' else .004 if role in ['movement','bridges','hour','minute','second','hub'] else .006
 if role!='glass' and len(mesh.polygons)>12:
  bevel=o.modifiers.new('Micro edge radii','BEVEL');bevel.width=width;bevel.segments=2
  bevel.limit_method='ANGLE';bevel.angle_limit=math.radians(38);bevel.use_clamp_overlap=True
  bevel.harden_normals=True
  for poly in mesh.polygons:poly.use_smooth=True
  normals=o.modifiers.new('Machined face normals','WEIGHTED_NORMAL');normals.keep_sharp=True;normals.weight=45
 o['photoreal_geometry']=True

# Physical face. Coordinates below are in the viewer's XY dial plane, +Z toward glass.
def xyz(x,y,z): return (x,-z,y)
def material(name,color,metal,rough):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1)
 bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough
 return m
brown=material('Dial_chestnut',(.055,.018,.009),.42,.36)
gold=material('Design_champagne',(.66,.43,.20),.95,.22)
lume=material('Design_ivory',(.82,.75,.57),.10,.31)
red=material('Design_seconds',(.24,.035,.018),.72,.24)
def register(o,role,mat):
 o['watch_component']=role;o['watch_source']='design';o['photoreal_geometry']=True
 o.data.materials.clear();o.data.materials.append(mat);objects.append(o)
 return o
def polygon(name,points,depth,thick,role,mat,angle=0):
 c,s=math.cos(angle),math.sin(angle)
 points=[(c*x-s*y,s*x+c*y) for x,y in points];n=len(points)
 vertices=[xyz(x,y,z) for z in (depth-thick/2,depth+thick/2) for x,y in points]
 faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
 o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o)
 uv=mesh.uv_layers.new(name='Surface UV')
 for poly in mesh.polygons:
  for li in poly.loop_indices:
   v=mesh.vertices[mesh.loops[li].vertex_index].co;uv.data[li].uv=(v.x*.6+.5,v.z*.6+.5)
 bevel=o.modifiers.new('Applied edge polish','BEVEL');bevel.width=.001;bevel.segments=2
 return register(o,role,mat)
def ring(name,cx,cy,r,inner,z,thick,role,mat):
 n=128;verts=[]
 for depth in (z-thick/2,z+thick/2):
  for rad in (r,inner):
   verts += [xyz(cx+rad*math.cos(i*2*math.pi/n),cy+rad*math.sin(i*2*math.pi/n),depth) for i in range(n)]
 faces=[]
 for i in range(n):
  j=(i+1)%n
  faces += [(i,j,n+j,n+i),(2*n+i,3*n+i,3*n+j,2*n+j),(i,2*n+i,2*n+j,j),(n+i,n+j,3*n+j,3*n+i)]
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],[tuple(reversed(f)) for f in faces]);mesh.update()
 o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);return register(o,role,mat)
# Solid plate with an actual aperture, so hidden gearing cannot overprint the hands.
bpy.ops.mesh.primitive_cylinder_add(vertices=160,radius=.823,depth=.012,location=xyz(0,0,.070),rotation=(math.pi/2,0,0))
plate=bpy.context.object;plate.name='design_openheart_dial'
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=.245,depth=.15,location=xyz(0,-.47,.070),rotation=(math.pi/2,0,0))
cutter=bpy.context.object;mod=plate.modifiers.new('Open heart aperture','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
bpy.context.view_layer.objects.active=plate;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
register(plate,'dial',brown)
# Planar UVs for subtle satin grain on the new dial.
uv=plate.data.uv_layers.new(name='Surface UV')
for poly in plate.data.polygons:
 for li in poly.loop_indices:
  v=plate.data.vertices[plate.data.loops[li].vertex_index].co;uv.data[li].uv=(v.x*.6+.5,v.z*.6+.5)
ring('design_chapter_ring',0,0,.813,.801,.079,.003,'dial',gold)
ring('design_openheart_bezel',0,-.47,.258,.244,.080,.004,'dial',gold)
markers=[]
for i in range(60):
 a=-i*2*math.pi/60;major=i%5==0;length=.077 if major else .022;width=.014 if major else .004
 # Six o'clock is retained at the perimeter, outside the open-heart opening.
 markers.append(polygon('design_index_%02d'%i,[(-width,.778-length),(width,.778-length),(width,.778),(-width,.778)],.080,.003,'dial',gold,a))
bpy.ops.object.select_all(action='DESELECT')
for o in markers:o.select_set(True)
bpy.context.view_layer.objects.active=markers[0];bpy.ops.object.join()
merged=markers[0];merged.name='design_sixty_applied_indices'
objects=[o for o in objects if o not in markers]+[merged]
def text(body,x,y,size,name):
 bpy.ops.object.text_add(location=xyz(x,y,.082),rotation=(math.pi/2,0,0))
 o=bpy.context.object;o.name=name;o.data.body=body;o.data.align_x='CENTER';o.data.align_y='CENTER';o.data.size=size;o.data.extrude=.0004;o.data.bevel_depth=.00015
 bpy.ops.object.convert(target='MESH');return register(bpy.context.object,'dial',gold)
for body,x,y,size in [('XII',0,.60,.105),('III',.60,0,.09),('IX',-.60,0,.09),('AETERNUM',0,.30,.070),('MECHANICA',0,.205,.032)]:text(body,x,y,size,'design_'+body)
# Sword hands with ivory inlays; all hand surfaces are above the face decoration.
for role,length,width,depth,angle in [('hour',.48,.035,.094,math.radians(55)),('minute',.68,.023,.102,math.radians(-60))]:
 polygon('design_'+role,[(-width,-.075),(width,-.075),(width*.65,length*.78),(0,length),(-width*.65,length*.78)],depth,.004,role,gold,angle)
 polygon('design_'+role+'_inlay',[(-width*.32,.10),(width*.32,.10),(width*.22,length*.73),(0,length*.89),(-width*.22,length*.73)],depth+.0027,.0007,role,lume,angle)
polygon('design_second',[(-.004,-.19),(.004,-.19),(.004,.72),(0,.75),(-.004,.72)],.111,.002,'second',red,math.radians(132))
ring('design_axial_cap',0,0,.038,.001,.114,.004,'hub',gold)
# Save measured vertex bounds, not semantic guesses, for depth-regression checks.
bpy.context.view_layer.update();bounds={}
for o in objects:
 ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=ev.to_mesh()
 coords=[o.matrix_world@v.co for v in mesh.vertices];ev.to_mesh_clear()
 z=[-v.y for v in coords];role=o['watch_component']
 lo,hi=bounds.get(role,[float('inf'),-float('inf')]);bounds[role]=[min(lo,min(z)),max(hi,max(z))]
assert max(bounds[k][1] for k in bounds if k.startswith('gear') or k in {'movement','bridges','tourbillon'}) < bounds['dial'][0]
assert min(bounds[k][0] for k in ['hour','minute','second','hub']) > bounds['dial'][1]
(ROOT/'docs/face-depths.json').write_text(json.dumps(bounds,indent=2)+'\n')

# Exclude original empties, animation rigs, lights and cameras from the derivative.
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
output=ROOT/'public/watch-photoreal.glb'
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,
 export_apply=True,export_animations=False,export_extras=True,export_yup=True,
 export_normals=True,export_texcoords=True,export_materials='EXPORT')
print('PHOTOREAL_DERIVATIVE',output,output.stat().st_size)
# Authoring scene retained for ray-traced rendering, without modifying the sources.
bpy.ops.wm.save_as_mainfile(filepath='/workspace/scratch/watch-photoreal.blend')
