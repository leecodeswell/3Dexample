import * as THREE from 'three';

// Screen-space studio cyclorama, also present in the transmission buffer.
// Three uses white at half alpha behind glass on a transparent canvas. A real
// backdrop avoids that fallback and lets detached sapphire refract the scene.
export function createStudioBackdrop(exposure) {
  const size = 256, data = new Uint16Array(size * size * 4);
  // Compensate for the final ACES display curve, keeping the site's dark
  // charcoal/olive gradient instead of lifting it to gray or crushing it black.
  const inverseFit = target => {
    let low = 0, high = 4;
    for (let i = 0; i < 24; i++) {
      const x = (low + high) / 2;
      const mapped = (x * (x + .0245786) - .000090537) / (x * (.983729 * x + .4329510) + .238081);
      if (mapped < target) low = x; else high = x;
    }
    return (low + high) / 2 * .6 / exposure;
  };
  const colors = ['#34372d', '#20231d', '#141613'].map(hex => {
    const c = new THREE.Color(hex); return [c.r, c.g, c.b].map(inverseFit);
  });
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const radius = Math.hypot((x / (size - 1) - .69) / (.69 * Math.SQRT2), (y / (size - 1) - .63) / (.63 * Math.SQRT2));
    const band = radius < .28 ? 0 : 1;
    const amount = THREE.MathUtils.clamp(band === 0 ? radius / .28 : (radius - .28) / .42, 0, 1);
    const index = (y * size + x) * 4;
    for (let channel = 0; channel < 3; channel++) data[index + channel] = THREE.DataUtils.toHalfFloat(THREE.MathUtils.lerp(colors[band][channel], colors[band + 1][channel], amount));
    data[index + 3] = THREE.DataUtils.toHalfFloat(1);
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.HalfFloatType);
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
