"""Generate a local, linear-HDR photographic lighting environment.
Analytic light rig, not a downloaded photograph. Requires NumPy; deterministic.
"""
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
w,h=1024,512
phi=(np.arange(h)+.5)/h*np.pi;theta=(np.arange(w)+.5)/w*2*np.pi-np.pi
p,t=np.meshgrid(phi,theta,indexing='ij')
d=np.stack((np.sin(p)*np.cos(t),np.cos(p),np.sin(p)*np.sin(t)),axis=-1)
# A dim neutral room, gentle ceiling bounce and dark floor give metals contrast.
base=.025+.065*np.maximum(d[:,:,1],0)+.015*np.exp(-d[:,:,1]**2/.035)
room=np.repeat(base[:,:,None],3,axis=2)*np.array([.96,1.,1.025])
def rectangle(direction,width,height,feather):
 n=np.array(direction,dtype=float);n/=np.linalg.norm(n)
 axis=np.array([0.,1.,0.]) if abs(n[1])<.93 else np.array([1.,0.,0.])
 right=np.cross(axis,n);right/=np.linalg.norm(right);up=np.cross(n,right)
 forward=d@n;a=np.abs(np.arctan2(d@right,np.maximum(forward,1e-8)))
 b=np.abs(np.arctan2(d@up,np.maximum(forward,1e-8)))
 sx=np.clip((width/2-a)/feather,0,1);sy=np.clip((height/2-b)/feather,0,1)
 return (sx*sx*(3-2*sx))*(sy*sy*(3-2*sy))*(forward>0)
for direction,width,height,energy,color in [
 ((-5,4,2),.45,1.05,3.2,(1,.93,.82)),
 ((5,1,2),.22,1.40,2.4,(.82,.91,1)),
 ((0,7,-1),1.05,.35,1.8,(1,.98,.94)),
 ((-1,-2,-6),1.1,.13,2.8,(1,.80,.57)),
 ((0,0,5),.14,.85,0.7,(1,1,1)),
 ((-3,0,5),.9,.6,1.0,(1,.98,.93)),
]:
 shape=rectangle(direction,width,height,.055)
 room+=shape[:,:,None]*energy*np.array(color)
# Encode Radiance RGBE with independent scanline channels (linear radiance).
maximum=room.max(axis=2);mantissa,exponent=np.frexp(maximum)
scale=mantissa*256/np.maximum(maximum,1e-32)
rgbe=np.concatenate((np.clip(room*scale[:,:,None],0,255).astype('uint8'),(exponent+128).astype('uint8')[:,:,None]),axis=2)
out=ROOT/'public/studio.hdr'
with out.open('wb') as f:
 f.write(f'#?RADIANCE\n# AETERNUM generated photographic studio\nFORMAT=32-bit_rle_rgbe\n\n-Y {h} +X {w}\n'.encode())
 for row in rgbe:
  f.write(bytes((2,2,w>>8,w&255)))
  for channel in range(4):
   values=row[:,channel].tobytes()
   for i in range(0,w,128):f.write(bytes((len(values[i:i+128]),))+values[i:i+128])
print('STUDIO_HDR',out,out.stat().st_size,'peak radiance',float(room.max()))
