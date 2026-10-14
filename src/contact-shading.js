import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';

// Contact shading treats the crystal as transparent: it must never replace the
// dial with an opaque dome in the depth/normal buffer.
export function createContactShading(scene, camera, glass) {
  const pass = new GTAOPass(scene, camera, 512, 512);
  pass.blendIntensity = .52;
  pass.updateGtaoMaterial({ radius: .10, thickness: .035, distanceFallOff: .65, samples: 8, screenSpaceRadius: false });
  pass.updatePdMaterial({ radius: 4, samples: 8 });
  const setSize = pass.setSize.bind(pass);
  pass.setSize = (width, height) => setSize(Math.max(1, Math.round(width * .5)), Math.max(1, Math.round(height * .5)));
  const render = pass.render.bind(pass);
  pass.render = (...args) => {
    const visibility = glass.map(mesh => mesh.visible);
    glass.forEach(mesh => { mesh.visible = false; });
    try { render(...args); }
    finally { glass.forEach((mesh, i) => { mesh.visible = visibility[i]; }); }
  };
  return pass;
}
