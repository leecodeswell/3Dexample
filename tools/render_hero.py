"""Ray-trace the actual display model, rather than generating an imagined watch.
blender -b /workspace/scratch/watch-photoreal.blend --python tools/render_hero.py
"""
import bpy,math
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[1]
s=bpy.context.scene
# Remove any authoring cameras and lights inherited from the source.
for o in list(bpy.data.objects):
 if o.type in {'LIGHT','CAMERA'}:bpy.data.objects.remove(o,do_unlink=True)
for o in bpy.data.objects:
 if o.type=='MESH' and not o.get('photoreal_geometry',False):o.hide_render=True
for m in bpy.data.materials:
 if not m.use_nodes:continue
 bs=m.node_tree.nodes.get('Principled BSDF')
 if not bs:continue
 name=m.name
 if name=='Glass':
  bs.inputs['Base Color'].default_value=(.97,.99,1,1);bs.inputs['Metallic'].default_value=0
  bs.inputs['Roughness'].default_value=.025;bs.inputs['Transmission Weight'].default_value=1;bs.inputs['IOR'].default_value=1.76
  bs.inputs['Alpha'].default_value=1
  output=m.node_tree.nodes.get('Material Output');transparent=m.node_tree.nodes.new('ShaderNodeBsdfTransparent');mix=m.node_tree.nodes.new('ShaderNodeMixShader');mix.inputs[0].default_value=.16
  m.node_tree.links.new(transparent.outputs[0],mix.inputs[1]);m.node_tree.links.new(bs.outputs[0],mix.inputs[2]);m.node_tree.links.new(mix.outputs[0],output.inputs['Surface'])
 elif 'gold' in name.lower() or 'send me your' in name or name=='Design_champagne':
  bs.inputs['Base Color'].default_value=(.57,.33,.13,1);bs.inputs['Metallic'].default_value=1;bs.inputs['Roughness'].default_value=.24
 elif name in ['MetalGrey','enjoy the model !'] or 'Metal/iron' in name:
  bs.inputs['Base Color'].default_value=(.43,.46,.50,1);bs.inputs['Metallic'].default_value=1;bs.inputs['Roughness'].default_value=.25
 if not name.startswith(('Design_','Dial_')) and name!='Glass':
  nodes=m.node_tree.nodes;links=m.node_tree.links;base=bs.inputs['Base Color']
  if base.is_linked:source=base.links[0].from_socket
  else:
   value=nodes.new('ShaderNodeRGB');value.outputs[0].default_value=base.default_value;source=value.outputs[0]
  separate=nodes.new('ShaderNodeSeparateColor');links.new(source,separate.inputs[0])
  maximum=nodes.new('ShaderNodeMath');maximum.operation='MAXIMUM';links.new(separate.outputs[0],maximum.inputs[0]);links.new(separate.outputs[2],maximum.inputs[1])
  dominance=nodes.new('ShaderNodeMath');dominance.operation='SUBTRACT';links.new(separate.outputs[1],dominance.inputs[0]);links.new(maximum.outputs[0],dominance.inputs[1])
  mask=nodes.new('ShaderNodeMapRange');mask.clamp=True;mask.inputs['From Min'].default_value=.005;mask.inputs['From Max'].default_value=.025;links.new(dominance.outputs[0],mask.inputs['Value'])
  luminance=nodes.new('ShaderNodeRGBToBW');links.new(source,luminance.inputs[0])
  color=nodes.new('ShaderNodeVectorMath');color.operation='SCALE';color.inputs[0].default_value=(2.04,.79,.31);links.new(luminance.outputs[0],color.inputs[3])
  mix=nodes.new('ShaderNodeMixRGB');links.new(mask.outputs[0],mix.inputs[0]);links.new(source,mix.inputs[1]);links.new(color.outputs[0],mix.inputs[2]);links.new(mix.outputs[0],base)
 if bs.inputs['Metallic'].default_value>.4 and name!='Glass':
  # Tileable generated shader microstructure (subtle enough for a new luxury watch).
  coord=m.node_tree.nodes.new('ShaderNodeTexCoord');mapping=m.node_tree.nodes.new('ShaderNodeVectorMath');mapping.operation='SCALE';mapping.inputs[3].default_value=4
  image=m.node_tree.nodes.new('ShaderNodeTexImage');image.image=bpy.data.images.load(str(ROOT/'public/surfaces/satin-normal.png'),check_existing=True);image.image.colorspace_settings.name='Non-Color'
  norm=m.node_tree.nodes.new('ShaderNodeNormalMap');norm.inputs['Strength'].default_value=.055
  links=m.node_tree.links;links.new(coord.outputs['UV'],mapping.inputs[0]);links.new(mapping.outputs[0],image.inputs['Vector']);links.new(image.outputs['Color'],norm.inputs['Color']);links.new(norm.outputs[0],bs.inputs['Normal'])
# Apply the exact opening pose used by the WebGL showcase.
C=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
# Three.js XYZ Euler = Rx Ry Rz; convert glTF world into Blender coordinates.
rotation=Matrix.Rotation(-.10,4,'X')@Matrix.Rotation(-.25,4,'Y')@Matrix.Rotation(-.14,4,'Z')
transform=C@rotation@C.inverted()
for o in bpy.data.objects:
 if o.type=='MESH' and 'watch_component' in o:o.matrix_world=transform@o.matrix_world
world=bpy.data.worlds.new('Black photographic studio');world.use_nodes=True
world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.07,.08,.07,1)
world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.16;s.world=world
for name,pos,size,power,color in [('Key',(-3,-4,5),4,450,(1,.86,.68)),('Strip',(4,-2,1),3,300,(.72,.84,1)),('Rim',(-2,3,2),3,550,(1,.70,.43)),('Top',(0,0,6),3,180,(1,1,.94))]:
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='RECTANGLE';data.size=size;data.size_y=size*.45;data.color=color
 o=bpy.data.objects.new(name,data);s.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.cameras.new('Hero');o=bpy.data.objects.new('Hero',data);s.collection.objects.link(o)
o.location=(1.4,-5.8,.7);target=Vector((0,.55,.05));o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler();data.sensor_fit='VERTICAL';data.sensor_height=24;data.lens=24/(2*math.tan(math.radians(18)));s.camera=o
s.render.engine='CYCLES';s.cycles.samples=128;s.cycles.use_adaptive_sampling=True;s.cycles.adaptive_threshold=.025;s.cycles.use_denoising=False
s.render.resolution_x=1280;s.render.resolution_y=900;s.render.resolution_percentage=100;s.render.film_transparent=True
s.view_settings.view_transform='AgX';s.view_settings.look='AgX - Medium High Contrast';s.view_settings.exposure=.15
s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA';s.render.filepath='/tmp/watch-hero.png'
bpy.ops.render.render(write_still=True)
