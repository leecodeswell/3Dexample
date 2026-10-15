import * as THREE from 'three';
import profiles from './finish-profiles.json';

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

function steelAtlasShader(material, strength) {
  const previous = material.onBeforeCompile, previousKey = material.customProgramCacheKey();
  material.onBeforeCompile = shader => {
    previous.call(material, shader);
    shader.uniforms.atlasSteelReflectance = { value: material.color.clone() };
    shader.uniforms.atlasNormalization = { value: strength };
    shader.fragmentShader = 'uniform vec3 atlasSteelReflectance; uniform float atlasNormalization;\n' + shader.fragmentShader.replace('#include <map_fragment>', `
      #include <map_fragment>
      float atlasMax=max(max(diffuseColor.r,diffuseColor.g),diffuseColor.b);
      float atlasMin=min(min(diffuseColor.r,diffuseColor.g),diffuseColor.b);
      float atlasNeutral=1.0-smoothstep(.20,.40,(atlasMax-atlasMin)/max(atlasMax,.0001));
      float atlasLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
      float atlasMid=smoothstep(.02,.075,atlasLuma)*(1.0-smoothstep(.36,.54,atlasLuma));
      diffuseColor.rgb=mix(diffuseColor.rgb,atlasSteelReflectance,atlasNeutral*atlasMid*atlasNormalization);
    `);
  };
  material.customProgramCacheKey = () => `calibrated-steel-v1:${previousKey}`;
}

function sapphireShader(material) {
  const previous = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey();
  material.onBeforeCompile = shader => {
    previous.call(material, shader);
    shader.uniforms.sapphireOpticalRoughness = { value: material.roughness };
    // Three clamps specular roughness to .0525 for its cubemap BRDF. Reusing
    // that floor for transmission blurs fine dial lettering. Keep that BRDF
    // protection, but use the crystal's actual optical roughness for refraction.
    shader.fragmentShader = 'uniform float sapphireOpticalRoughness;\n' + shader.fragmentShader.replace(
      '#include <transmission_pars_fragment>',
      THREE.ShaderChunk.transmission_pars_fragment.replace(
        'log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior )',
        'log2( transmissionSamplerSize.x ) * applyIorToRoughness( sapphireOpticalRoughness, ior )',
      ).replace(
        'return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );',
        'return textureLod( transmissionSamplerMap, fragCoord.xy, lod );',
      ),
    );
  };
  material.customProgramCacheKey = () => `sapphire-optics-v2:${previousKey}`;
  return material;
}

export function finishProfileName(name, part) {
  if (part.startsWith('gear')) return 'gear';
  if (name === 'Glass') return 'sapphire';
  if (name === 'Bezel_enamel') return 'enamel';
  if (name === 'Dial_chestnut') return 'dial';
  if (name === 'Design_ivory') return 'ivory';
  if (name === 'Design_seconds') return 'seconds';
  if (name === 'Design_champagne') return 'goldPolished';
  if (name.includes('gold') || name.includes('send_me_your_final_work')) return 'gold';
  if (name === 'Green') return 'ceramic';
  if (/Opaque_Plastic|Opaque Plastic/.test(name)) return 'ruby';
  if (['MetalGrey', 'Image', 'Image2', 'DarkPins.001', 'enjoy_the_model'].includes(name) || /^Metal/.test(name)) {
    return ['case', 'crown', 'backplate', 'hub'].includes(part) ? 'steelPolished' : 'steelBrushed';
  }
  return null;
}

export function createTreatments() {
  const loader = new THREE.TextureLoader(), textures = [], maps = {}, pending = [];
  for (const finish of ['satin', 'machined', 'polished', 'sunburst']) {
    maps[finish] = {};
    for (const channel of ['normal', 'roughness']) {
      pending.push(loader.loadAsync(`${import.meta.env.BASE_URL}surfaces/${finish}-${channel}.png`).then(texture => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.setScalar(finish === 'sunburst' ? 1 : finish === 'polished' ? 2 : 4);
        texture.anisotropy = 8;
        maps[finish][channel] = texture; textures.push(texture);
      }));
    }
  }
  const cache = new Map();
  const variants = (original, hasUV = true, part = '') => {
    const profileName = finishProfileName(original.name, part);
    const key = `${original.uuid}:${hasUV}:${profileName}`;
    if (cache.has(key)) return cache.get(key);
    const brown = brownShader(original.clone());
    const studio = new THREE.MeshPhysicalMaterial();
    if (original.isMeshPhysicalMaterial) studio.copy(original);
    else {
      THREE.MeshStandardMaterial.prototype.copy.call(studio, original);
      studio.defines = { STANDARD: '', PHYSICAL: '' };
    }
    const profile = profiles[profileName];
    if (profile) {
      for (const [field, value] of Object.entries(profile)) {
        if (field === 'color') studio.color.set(value);
        else if (!['surface', 'normalStrength', 'atlasNormalization'].includes(field)) studio[field] = Array.isArray(value) ? [...value] : value;
      }
      if (hasUV && profile.surface) {
        studio.roughnessMap = maps[profile.surface].roughness;
        if (!original.normalMap) {
          studio.normalMap = maps[profile.surface].normal;
          studio.normalScale.setScalar(profile.normalStrength);
        }
      }
    }
    if (profileName === 'sapphire') {
      // Transmission already models transparent glass. Alpha blending would
      // artificially dilute Fresnel reflections and conceal its real refraction.
      studio.transparent = false; studio.depthWrite = false; studio.side = THREE.FrontSide;
      studio.attenuationColor.set('#edf3fa'); studio.attenuationDistance = 3;
    }
    // These imported UV islands include collapsed edges; anisotropic texture
    // sampling is safe, derivative-based material anisotropy is not.
    studio.anisotropy = 0;
    const brownStudio = brownShader(studio.clone());
    if (profileName === 'sapphire') { sapphireShader(studio); sapphireShader(brownStudio); }
    if (original.map && profile?.atlasNormalization) {
      steelAtlasShader(studio, profile.atlasNormalization);
      steelAtlasShader(brownStudio, profile.atlasNormalization);
    }
    const value = { original, brown, studio, brownStudio, profile: profileName };
    cache.set(key, value); return value;
  };
  return { ready: Promise.all(pending), variants, dispose() {
    textures.forEach(t => t.dispose());
    cache.forEach(v => [v.original, v.brown, v.studio, v.brownStudio].forEach(m => m.dispose()));
  } };
}
