"""Deterministic, tileable PBR micro-surface maps; no source images are edited."""
from pathlib import Path
import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parents[1] / 'public/surfaces'
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(4187)
n = 512
y, x = np.mgrid[0:n,0:n] / n

def save_surface(name, height, roughness):
    dx = (np.roll(height,-1,1)-np.roll(height,1,1))* 2.5
    dy = (np.roll(height,-1,0)-np.roll(height,1,0))* 2.5
    normals = np.stack([-dx,-dy,np.ones_like(dx)],axis=-1)
    normals /= np.linalg.norm(normals,axis=-1,keepdims=True)
    Image.fromarray(np.uint8(np.clip(normals*.5+.5,0,1)*255)).save(OUT/f'{name}-normal.png')
    gray=np.uint8(np.clip(roughness,0,1)*255)
    Image.fromarray(np.repeat(gray[:,:,None],3,axis=2)).save(OUT/f'{name}-roughness.png')

noise = rng.normal(0,1,(n,n))
# Integer-frequency waves make both borders repeat exactly.
brush = .75*np.sin(y*2*np.pi*171+.12*np.sin(x*2*np.pi*7)) + .32*np.sin(y*2*np.pi*67) + noise*.009
save_surface('satin',brush,.76 + .14*np.sin(y*2*np.pi*71) + noise*.010)
radial = .4*np.sin((x+y)*2*np.pi*143) + .24*np.sin(x*2*np.pi*37) + noise*.010
save_surface('machined',radial,.78 + noise*.025 + .12*np.sin(x*2*np.pi*11))
# Polished finish with sparse shallow hairline scratches, rather than noisy damage.
polished=np.zeros((n,n));r=np.full((n,n),.78)
for _ in range(14):
 row=int(rng.integers(n));phase=rng.random()*2*np.pi
 stroke=(.5+.5*np.sin(x[row]*2*np.pi*int(rng.integers(1,5))+phase))**4
 polished[row]+=stroke*.10;r[row]+=stroke*.18
save_surface('polished',polished,r)
# Radial satin cuts for the dial; the central fade avoids aliasing at the arbor.
u=x-.5;v=y-.5;radius=np.hypot(u,v);angle=np.arctan2(v,u)
sunburst=.22*np.sin(angle*761)*np.clip(radius/.12,0,1)+noise*.003
save_surface('sunburst',sunburst,.78+.15*np.sin(angle*97)*np.clip(radius/.2,0,1))
print('Generated eight repeatable PBR maps in',OUT)
