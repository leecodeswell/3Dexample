import * as THREE from 'three';

// Only green hues change; source UVs, imagery and engraved markings survive.
export function brownShader(material) {
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #include <map_fragment>
      float dominance=diffuseColor.g-max(diffuseColor.r,diffuseColor.b);
      float mask=smoothstep(.0008,.012,dominance)*smoothstep(1.025,1.20,diffuseColor.g/max(max(diffuseColor.r,diffuseColor.b),.0001));
      vec3 chestnut=vec3(.314,.122,.048);
      float luma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
      diffuseColor.rgb=mix(diffuseColor.rgb,chestnut*luma/dot(chestnut,vec3(.2126,.7152,.0722)),mask);
    `);
  };
  material.customProgramCacheKey = () => 'aeternum-chestnut-v2';
  return material;
}

export function createTreatments() {
  const loader = new THREE.TextureLoader(), textures = [], maps = {}, pending = [];
  for (const finish of ['satin', 'machined', 'polished']) {
    maps[finish] = {};
    for (const channel of ['normal', 'roughness']) {
      pending.push(loader.loadAsync(`/surfaces/${finish}-${channel}.png`).then(texture => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(finish === 'polished' ? 2 : 4, finish === 'polished' ? 2 : 4);
        texture.anisotropy = 4;
        maps[finish][channel] = texture; textures.push(texture);
      }));
    }
  }
  const cache = new Map();
  const variants = (original, hasUV = true) => {
    const key = `${original.uuid}:${hasUV}`;
    if (cache.has(key)) return cache.get(key);
    const brown = brownShader(original.clone());
    const studio = new THREE.MeshPhysicalMaterial();
    if (original.isMeshPhysicalMaterial) studio.copy(original);
    else {
      THREE.MeshStandardMaterial.prototype.copy.call(studio, original);
      // Standard.copy resets defines; restore the physical shader for IOR/clearcoat.
      studio.defines = { STANDARD: '', PHYSICAL: '' };
    }
    const name = original.name;
    let finish = 'machined', intensity = .06;
    if (name === 'Glass') {
      studio.color.set('#ffffff'); studio.metalness = 0; studio.roughness = .025;
      studio.transmission = 1; studio.thickness = .04; studio.ior = 1.76;
      studio.opacity = .16; studio.transparent = true; studio.depthWrite = false;
      studio.clearcoat = .25; studio.clearcoatRoughness = .03;
    } else if (name === 'Dial_chestnut') {
      studio.color.set('#482716'); studio.metalness = .42; studio.roughness = .48;
      studio.clearcoat = .28; studio.clearcoatRoughness = .30;
      finish = 'satin'; intensity = .025;
    } else if (name === 'Design_ivory') {
      studio.metalness = .1; studio.roughness = .35;
    } else if (name === 'Design_seconds') {
      studio.color.set('#8c3826'); studio.metalness = .72; studio.roughness = .30;
      finish = 'polished';
    } else if (name === 'Design_champagne' || name.includes('gold') || name.includes('send_me_your_final_work')) {
      studio.color.set('#c79c62'); studio.metalness = 1; studio.roughness = .32;
      studio.clearcoat = .12; studio.clearcoatRoughness = .18;
      finish = name === 'Design_champagne' ? 'polished' : 'machined';
    } else if (['MetalGrey', 'Image', 'Image2', 'DarkPins.001'].includes(name)) {
      studio.metalness = name === 'MetalGrey' ? 1 : .80;
      studio.roughness = name === 'MetalGrey' ? .30 : .38;
      studio.clearcoat = .12; studio.clearcoatRoughness = .22;
      finish = name === 'MetalGrey' ? 'satin' : 'polished';
    } else if (name === 'Green') {
      studio.metalness = .55; studio.roughness = .38;
      studio.clearcoat = .35; studio.clearcoatRoughness = .22;
      finish = 'satin';
    } else if (name === 'enjoy_the_model' || /Metaliron|Metal\/iron|MetalSteel|MetalMachining/.test(name)) {
      studio.color.set('#717981'); studio.metalness = 1; studio.roughness = .34;
      finish = 'satin';
    } else if (/Opaque_Plastic|Opaque Plastic/.test(name)) {
      studio.color.set('#721f34'); studio.metalness = .05; studio.roughness = .16; studio.clearcoat = .8;
    }
    // UV-free balance springs keep their original shading; no invented UV mapping.
    if (hasUV && studio.metalness > .4 && name !== 'Glass') {
      studio.roughnessMap = maps[finish].roughness;
      if (!original.normalMap) { studio.normalMap = maps[finish].normal; studio.normalScale.set(intensity, intensity); }
      // Imported and text UVs include degenerate islands; derivative-based anisotropy
      // can produce NaNs on their edges. Fine grain is carried by the normal map.
      studio.anisotropy = 0;
      studio.anisotropyRotation = Math.PI / 2;
    }
    const brownStudio = brownShader(studio.clone());
    const value = { original, brown, studio, brownStudio }; cache.set(key, value); return value;
  };
  return { ready: Promise.all(pending), variants, dispose() {
    textures.forEach(t => t.dispose());
    cache.forEach(v => [v.original, v.brown, v.studio, v.brownStudio].forEach(m => m.dispose()));
  } };
}
