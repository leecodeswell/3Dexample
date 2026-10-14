"""Render the single active watch with its shared finish profiles and local HDR.
blender -b --factory-startup --python-exit-code 1 --python tools/render_hero.py -- \
  --denoiser /path/to/oidnDenoise
Without a denoiser, a regular Cycles PNG is produced. Does not change the GLB.
"""
import argparse,array,json,math,subprocess,sys
from pathlib import Path
import bpy
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--denoiser',type=Path)
parser.add_argument('--output',type=Path,default=Path('/tmp/watch-hero.png'))
parser.add_argument('--width',type=int,default=1920)
parser.add_argument('--samples',type=int,default=128)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
config=json.loads((ROOT/'src/model-config.json').read_text())
profiles=json.loads((ROOT/'src/finish-profiles.json').read_text())
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public'/config['model']['asset'].lstrip('/')))
s=bpy.context.scene
objects=[o for o in bpy.data.objects if o.type=='MESH'];assert len(objects)==config['model']['meshCount']
def linear(hexcode):
 rgb=[int(hexcode[i:i+2],16)/255 for i in [1,3,5]]
 return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb)
def profile_for(name,part):
 if name=='Glass':return 'sapphire'
 if name=='Bezel_enamel':return 'enamel'
 if name=='Dial_chestnut':return 'dial'
 if name=='Design_ivory':return 'ivory'
 if name=='Design_seconds':return 'seconds'
 if name=='Design_champagne':return 'goldPolished'
 if 'gold' in name or 'send_me_your_final_work' in name:return 'gold'
 if name=='Green':return 'ceramic'
 if 'Opaque_Plastic' in name or 'Opaque Plastic' in name:return 'ruby'
 if name in ['MetalGrey','Image','Image2','DarkPins.001','enjoy_the_model'] or name.startswith('Metal'):
  return 'steelPolished' if part in ['case','crown','backplate','hub'] else 'steelBrushed'
 return None
cache={}
for obj in objects:
 for slot in obj.material_slots:
  original=slot.material;which=profile_for(original.name,obj.get('watch_component'));key=(original.name,which)
  if key in cache:slot.material=cache[key];continue
  m=original.copy();cache[key]=m;slot.material=m
  bs=m.node_tree.nodes.get('Principled BSDF')
  if not bs:continue
  nodes=m.node_tree.nodes;links=m.node_tree.links
  profile=profiles.get(which,{})
  base=bs.inputs['Base Color'];old=original.diffuse_color[:3]
  if base.is_linked:source=base.links[0].from_socket
  else:
   value=nodes.new('ShaderNodeRGB');value.outputs[0].default_value=base.default_value;source=value.outputs[0]
  if 'color' in profile:
   rgb=linear(profile['color'])
   if base.is_linked:
    multiply=nodes.new('ShaderNodeMixRGB');multiply.blend_type='MULTIPLY';multiply.inputs[0].default_value=1
    links.new(source,multiply.inputs[1]);multiply.inputs[2].default_value=(*(rgb[i]/max(old[i],.0001) for i in range(3)),1);source=multiply.outputs[0]
   else:
    value=nodes.new('ShaderNodeRGB');value.outputs[0].default_value=(*rgb,1);source=value.outputs[0]
  # Calibrate neutral atlas midtones to steel's reflectance. Black engraving,
  # light inscriptions and colored inserts keep their source texture values.
  if profile.get('atlasNormalization') and base.is_linked:
   separate=nodes.new('ShaderNodeSeparateColor');links.new(source,separate.inputs[0])
   maximum=nodes.new('ShaderNodeMath');maximum.operation='MAXIMUM';minimum=nodes.new('ShaderNodeMath');minimum.operation='MINIMUM'
   for node,operation in [(maximum,'MAXIMUM'),(minimum,'MINIMUM')]:
    first=nodes.new('ShaderNodeMath');first.operation=operation;links.new(separate.outputs[0],first.inputs[0]);links.new(separate.outputs[1],first.inputs[1]);links.new(first.outputs[0],node.inputs[0]);links.new(separate.outputs[2],node.inputs[1])
   spread=nodes.new('ShaderNodeMath');spread.operation='SUBTRACT';links.new(maximum.outputs[0],spread.inputs[0]);links.new(minimum.outputs[0],spread.inputs[1])
   sat=nodes.new('ShaderNodeMath');sat.operation='DIVIDE';links.new(spread.outputs[0],sat.inputs[0]);links.new(maximum.outputs[0],sat.inputs[1])
   neutral=nodes.new('ShaderNodeMapRange');neutral.interpolation_type='SMOOTHSTEP';neutral.clamp=True;neutral.inputs['From Min'].default_value=.20;neutral.inputs['From Max'].default_value=.40;neutral.inputs['To Min'].default_value=1;neutral.inputs['To Max'].default_value=0;links.new(sat.outputs[0],neutral.inputs['Value'])
   luma=nodes.new('ShaderNodeRGBToBW');links.new(source,luma.inputs[0]);ramps=[]
   for low,high,invert in [(.02,.075,False),(.36,.54,True)]:
    ramp=nodes.new('ShaderNodeMapRange');ramp.interpolation_type='SMOOTHSTEP';ramp.clamp=True;ramp.inputs['From Min'].default_value=low;ramp.inputs['From Max'].default_value=high;ramp.inputs['To Min'].default_value=1 if invert else 0;ramp.inputs['To Max'].default_value=0 if invert else 1;links.new(luma.outputs[0],ramp.inputs['Value']);ramps.append(ramp.outputs[0])
   factor=neutral.outputs[0]
   for other in [*ramps,profile['atlasNormalization']]:
    multiply=nodes.new('ShaderNodeMath');multiply.operation='MULTIPLY';links.new(factor,multiply.inputs[0])
    if isinstance(other,float):multiply.inputs[1].default_value=other
    else:links.new(other,multiply.inputs[1])
    factor=multiply.outputs[0]
   mix=nodes.new('ShaderNodeMixRGB');links.new(factor,mix.inputs[0]);links.new(source,mix.inputs[1]);mix.inputs[2].default_value=(*linear(profile['color']),1);source=mix.outputs[0]
  # Match the website's selective chestnut remapping without rewriting textures.
  if which not in ['dial','sapphire','ivory','seconds']:
   separate=nodes.new('ShaderNodeSeparateColor');links.new(source,separate.inputs[0])
   maximum=nodes.new('ShaderNodeMath');maximum.operation='MAXIMUM';links.new(separate.outputs[0],maximum.inputs[0]);links.new(separate.outputs[2],maximum.inputs[1])
   dominance=nodes.new('ShaderNodeMath');dominance.operation='SUBTRACT';links.new(separate.outputs[1],dominance.inputs[0]);links.new(maximum.outputs[0],dominance.inputs[1])
   mask=nodes.new('ShaderNodeMapRange');mask.interpolation_type='SMOOTHSTEP';mask.clamp=True;mask.inputs['From Min'].default_value=.0008;mask.inputs['From Max'].default_value=.012;links.new(dominance.outputs[0],mask.inputs['Value'])
   ratio=nodes.new('ShaderNodeMath');ratio.operation='DIVIDE';links.new(separate.outputs[1],ratio.inputs[0]);links.new(maximum.outputs[0],ratio.inputs[1])
   ratio_mask=nodes.new('ShaderNodeMapRange');ratio_mask.interpolation_type='SMOOTHSTEP';ratio_mask.clamp=True;ratio_mask.inputs['From Min'].default_value=1.025;ratio_mask.inputs['From Max'].default_value=1.20;links.new(ratio.outputs[0],ratio_mask.inputs['Value'])
   combined=nodes.new('ShaderNodeMath');combined.operation='MULTIPLY';links.new(mask.outputs[0],combined.inputs[0]);links.new(ratio_mask.outputs[0],combined.inputs[1])
   luminance=nodes.new('ShaderNodeRGBToBW');links.new(source,luminance.inputs[0])
   shade=nodes.new('ShaderNodeVectorMath');shade.operation='SCALE';shade.inputs[0].default_value=(2.04,.79,.31);links.new(luminance.outputs[0],shade.inputs[3])
   mix=nodes.new('ShaderNodeMixRGB');links.new(combined.outputs[0],mix.inputs[0]);links.new(source,mix.inputs[1]);links.new(shade.outputs[0],mix.inputs[2]);source=mix.outputs[0]
  links.new(source,base)
  fields={'metalness':'Metallic','roughness':'Roughness','clearcoat':'Coat Weight','clearcoatRoughness':'Coat Roughness','transmission':'Transmission Weight','ior':'IOR'}
  for field,socket in fields.items():
   if field in profile:bs.inputs[socket].default_value=profile[field]
  if which=='sapphire':
   # Principled's transmitting lobe ignores its opaque specular-level control.
   # An explicit coated Fresnel mix matches Three's low-reflectance sapphire:
   # all camera light is either refracted at IOR 1.76 or reflected, never faded.
   refraction=nodes.new('ShaderNodeBsdfRefraction');refraction.inputs['Color'].default_value=(1,1,1,1);refraction.inputs['Roughness'].default_value=profile['roughness'];refraction.inputs['IOR'].default_value=profile['ior']
   reflection=nodes.new('ShaderNodeBsdfAnisotropic');reflection.inputs['Color'].default_value=(.97,.985,1,1);reflection.inputs['Roughness'].default_value=profile['roughness']
   fresnel=nodes.new('ShaderNodeFresnel');fresnel.inputs['IOR'].default_value=profile['ior'];coating=nodes.new('ShaderNodeMath');coating.operation='MULTIPLY';coating.inputs[1].default_value=profile['specularIntensity'];links.new(fresnel.outputs[0],coating.inputs[0])
   surface=nodes.new('ShaderNodeMixShader');links.new(coating.outputs[0],surface.inputs[0]);links.new(refraction.outputs[0],surface.inputs[1]);links.new(reflection.outputs[0],surface.inputs[2])
   # Match the interactive no-shadow crystal; other components still cast shadows.
   path=nodes.new('ShaderNodeLightPath');transparent=nodes.new('ShaderNodeBsdfTransparent');mix=nodes.new('ShaderNodeMixShader');links.new(path.outputs['Is Shadow Ray'],mix.inputs[0]);links.new(surface.outputs[0],mix.inputs[1]);links.new(transparent.outputs[0],mix.inputs[2]);links.new(mix.outputs[0],nodes.get('Material Output').inputs['Surface'])
  if profile.get('surface') and obj.data.uv_layers:
   surface=profile['surface'];coord=nodes.new('ShaderNodeTexCoord');mapping=nodes.new('ShaderNodeVectorMath');mapping.operation='SCALE';mapping.inputs[3].default_value=1 if surface=='sunburst' else 2 if surface=='polished' else 4
   links.new(coord.outputs['UV'],mapping.inputs[0])
   for channel in ['roughness','normal']:
    texture=nodes.new('ShaderNodeTexImage');texture.image=bpy.data.images.load(str(ROOT/f'public/surfaces/{surface}-{channel}.png'),check_existing=True);texture.image.colorspace_settings.name='Non-Color';links.new(mapping.outputs[0],texture.inputs['Vector'])
    if channel=='roughness':
     multiply=nodes.new('ShaderNodeMath');multiply.operation='MULTIPLY';multiply.inputs[1].default_value=profile['roughness'];links.new(texture.outputs[0],multiply.inputs[0]);links.new(multiply.outputs[0],bs.inputs['Roughness'])
    elif not bs.inputs['Normal'].is_linked:
     normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=profile['normalStrength'];links.new(texture.outputs[0],normal.inputs['Color']);links.new(normal.outputs[0],bs.inputs['Normal'])
C=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
rotation=Matrix.Rotation(-.10,4,'X')@Matrix.Rotation(-.25,4,'Y')@Matrix.Rotation(-.14,4,'Z')
for obj in objects:obj.matrix_world=C@rotation@C.inverted()@obj.matrix_world
world=bpy.data.worlds.new('Photographic HDR studio');world.use_nodes=True;s.world=world
nodes=world.node_tree.nodes;links=world.node_tree.links
texture=nodes.new('ShaderNodeTexEnvironment');texture.image=bpy.data.images.load(str(ROOT/'public'/config['environment'].lstrip('/')))
background=nodes.get('Background');background.inputs['Strength'].default_value=.85;links.new(texture.outputs['Color'],background.inputs['Color'])
for name,pos,power,color in [('Key',(-3,-7,6),.85,(1,.93,.81)),('Fill',(5,-3,-1),.22,(.78,.86,1)),('Rim',(-4,2,-3),.90,(1,.78,.49))]:
 light=bpy.data.lights.new(name,'SUN');light.energy=power;light.angle=.035;light.color=color
 o=bpy.data.objects.new(name,light);s.collection.objects.link(o);o.rotation_euler=(-Vector(pos)).to_track_quat('-Z','Y').to_euler()
light=bpy.data.lights.new('Softbox','AREA');light.energy=45;light.shape='RECTANGLE';light.size=3;light.size_y=5;light.color=(1,.94,.86)
o=bpy.data.objects.new('Softbox',light);s.collection.objects.link(o);o.location=(-4,-3,4);o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.cameras.new('Hero');o=bpy.data.objects.new('Hero',data);s.collection.objects.link(o)
o.location=(1.4,-5.8,.7);o.rotation_euler=(Vector((0,.55,.05))-o.location).to_track_quat('-Z','Y').to_euler()
data.sensor_fit='VERTICAL';data.sensor_height=24;data.lens=24/(2*math.tan(math.radians(18)));s.camera=o
s.render.engine='CYCLES';s.cycles.samples=args.samples;s.cycles.use_adaptive_sampling=True;s.cycles.adaptive_threshold=.02;s.cycles.adaptive_min_samples=16;s.cycles.use_denoising=False
s.cycles.caustics_reflective=False;s.cycles.caustics_refractive=False;s.cycles.sample_clamp_direct=12
s.cycles.max_bounces=10;s.cycles.transmission_bounces=8;s.cycles.sample_clamp_indirect=6
s.render.resolution_x=args.width;s.render.resolution_y=round(args.width*900/1280);s.render.resolution_percentage=100;s.render.film_transparent=True
s.view_settings.view_transform='AgX';s.view_settings.look='AgX - Medium High Contrast';s.view_settings.exposure=.3
args.output.parent.mkdir(parents=True,exist_ok=True)
work=args.output.parent/'watch-render';work.mkdir(exist_ok=True)
if not args.denoiser:
 s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA';s.render.filepath=str(args.output);bpy.ops.render.render(write_still=True)
else:
 s.use_nodes=True;nodes=s.node_tree.nodes;nodes.clear();render=nodes.new('CompositorNodeRLayers');composite=nodes.new('CompositorNodeComposite');s.node_tree.links.new(render.outputs['Image'],composite.inputs[0])
 s.view_layers[0].cycles.denoising_store_passes=True
 for name,socket in [('albedo','Denoising Albedo'),('normal','Denoising Normal')]:
  output=nodes.new('CompositorNodeOutputFile');output.base_path=str(work);output.format.file_format='OPEN_EXR';output.format.color_depth='32';output.file_slots[0].path=name
  s.node_tree.links.new(render.outputs[socket],output.inputs[0])
 s.render.image_settings.file_format='OPEN_EXR';s.render.image_settings.color_mode='RGBA';s.render.image_settings.color_depth='32';s.render.filepath=str(work/'color.exr')
 bpy.ops.render.render(write_still=True)
 def pfm(path,output):
  img=bpy.data.images.load(str(path),check_existing=False);rgba=array.array('f',[0])*(img.size[0]*img.size[1]*4);img.pixels.foreach_get(rgba)
  rgb=array.array('f',(rgba[i+c] for i in range(0,len(rgba),4) for c in range(3)))
  with output.open('wb') as f:f.write(f'PF\n{img.size[0]} {img.size[1]}\n-1.0\n'.encode());rgb.tofile(f)
  return rgba
 original=pfm(work/'color.exr',work/'color.pfm')
 for name in ['albedo','normal']:pfm(work/f'{name}{s.frame_current:04}.exr',work/f'{name}.pfm')
 subprocess.run([str(args.denoiser),'--device','cpu','--hdr',str(work/'color.pfm'),'--alb',str(work/'albedo.pfm'),'--nrm',str(work/'normal.pfm'),'--quality','high','--threads','8','--output',str(work/'denoised.pfm')],check=True)
 with (work/'denoised.pfm').open('rb') as f:
  assert f.readline().strip()==b'PF';width,height=map(int,f.readline().split());assert float(f.readline())<0;rgb=array.array('f');rgb.frombytes(f.read())
 rgba=array.array('f',(original[i+3] if c==3 else rgb[i//4*3+c] for i in range(0,len(original),4) for c in range(4)))
 image=bpy.data.images.new('Denoised actual watch',width,height,alpha=True,float_buffer=True);image.pixels.foreach_set(rgba)
 s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA';s.render.image_settings.color_depth='8';image.save_render(str(args.output),scene=s)
print('HERO_RENDER',args.output)
