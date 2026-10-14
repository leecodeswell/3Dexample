import * as THREE from 'three';

// Shader treatment keeps every uploaded UV, embedded map, and engraved marking.
// Only green hues are remapped; white indices and neutral textures retain their color.
export function brownShader(material) {
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #include <map_fragment>
      float greenDominance = diffuseColor.g - max(diffuseColor.r, diffuseColor.b);
      float greenMask = smoothstep(0.0008, 0.012, greenDominance)
        * smoothstep(1.025, 1.20, diffuseColor.g / max(max(diffuseColor.r, diffuseColor.b), 0.0001));
      float originalLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
      vec3 chestnut = vec3(0.314, 0.122, 0.048);
      vec3 brown = chestnut * originalLuma / dot(chestnut, vec3(0.2126, 0.7152, 0.0722));
      diffuseColor.rgb = mix(diffuseColor.rgb, brown, greenMask);
    `);
  };
  material.customProgramCacheKey = () => 'aeternum-chestnut-v1';
  return material;
}

function brushMap() {
  const size = 128, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    const grain = Math.sin(y * 1.91) * 7 + Math.sin(y * .37 + x * .04) * 3;
    pixels[i] = 128; pixels[i + 1] = Math.round(128 + grain); pixels[i + 2] = 255; pixels[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(7, 7);
  texture.magFilter = texture.minFilter = THREE.LinearFilter; texture.needsUpdate = true;
  return texture;
}

export function createTreatments() {
  const brushing = brushMap();
  const cache = new Map();
  const variants = original => {
    if (cache.has(original)) return cache.get(original);
    const brown = brownShader(original.clone());
    const studio = new THREE.MeshPhysicalMaterial();
    THREE.MeshStandardMaterial.prototype.copy.call(studio, original);
    const name = original.name;
    if (name === 'Glass') {
      studio.color.set('#f5ece0'); studio.metalness = 0; studio.roughness = .07;
      studio.transmission = .95; studio.thickness = .07; studio.ior = 1.46;
      studio.opacity = .18; studio.transparent = true; studio.depthWrite = false;
      studio.clearcoat = 1; studio.clearcoatRoughness = .035;
    } else if (['MetalGrey', 'Image', 'Image2', 'DarkPins.001'].includes(name)) {
      studio.metalness = name === 'MetalGrey' ? .92 : .72;
      studio.roughness = name === 'MetalGrey' ? .29 : .34;
      studio.clearcoat = .25; studio.clearcoatRoughness = .22;
      if (name === 'MetalGrey' && !original.normalMap) {
        studio.normalMap = brushing; studio.normalScale.set(.13, .13);
      }
    } else if (name === 'Green') {
      studio.metalness = .55; studio.roughness = .30;
      studio.clearcoat = .45; studio.clearcoatRoughness = .16;
    }
    const brownStudio = brownShader(studio.clone());
    const value = { original, brown, studio, brownStudio }; cache.set(original, value); return value;
  };
  return { variants, dispose() { brushing.dispose(); cache.forEach(v => [v.original, v.brown, v.studio, v.brownStudio].forEach(m => m.dispose())); } };
}
