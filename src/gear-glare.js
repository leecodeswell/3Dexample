import * as THREE from 'three';

// Small HDR star kernels attached to real tooth edges. Depth testing keeps
// hidden gears from shining through the dial, case or other mechanism parts.
export function createGearGlare(meshes) {
  const size = 128, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + .5) / size * 2 - 1, v = (y + .5) / size * 2 - 1;
    const r = Math.hypot(u, v);
    const core = Math.exp(-r * r * 160);
    const rays = Math.exp(-Math.abs(u * v) * 180) * Math.exp(-r * 5);
    const diagonal = Math.exp(-Math.abs(u * u - v * v) * 220) * Math.exp(-r * 10) * .3;
    const i = (y * size + x) * 4;
    pixels[i] = pixels[i + 1] = pixels[i + 2] = 255;
    pixels[i + 3] = Math.round(Math.min(1, core + rays * .7 + diagonal) * 255);
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.needsUpdate = true;
  const entries = meshes.filter(mesh => mesh.userData.part?.startsWith('gear')).map((mesh, index) => {
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox, center = box.getCenter(new THREE.Vector3());
    const span = box.getSize(new THREE.Vector3());
    const material = new THREE.SpriteMaterial({map: texture, color: index % 3 ? 0xffd9a1 : 0xb8e6ff, blending: THREE.AdditiveBlending, depthTest: true, depthWrite: false, toneMapped: false});
    const sprite = new THREE.Sprite(material);
    sprite.name = `tooth-glare-${mesh.userData.part}`;
    const angle = index * 2.39996;
    sprite.position.set(center.x + Math.cos(angle) * span.x * .36, center.y + Math.sin(angle) * span.y * .36, box.max.z + Math.max(span.z * .03, .0001));
    const width = Math.max(span.x, span.y) * .65;
    sprite.scale.set(width, width, 1);
    mesh.add(sprite);
    return {sprite, material, index, width};
  });
  const world = new THREE.Vector3(), normal = new THREE.Vector3(), view = new THREE.Vector3();
  return {
    count: entries.length,
    update(camera, progress, orbit, enabled, reducedMotion) {
      for (const {sprite, material, index, width} of entries) {
        sprite.visible = enabled;
        if (!enabled) continue;
        sprite.getWorldPosition(world);
        normal.set(0, 0, 1).transformDirection(sprite.parent.matrixWorld);
        view.copy(camera.position).sub(world).normalize();
        const facing = THREE.MathUtils.smoothstep(normal.dot(view), .05, .65);
        const sweep = reducedMotion ? .65 : .35 + .65 * Math.pow(.5 + .5 * Math.sin(progress * 15 + orbit * 9 + index * 1.7 + view.x * 3), 5);
        material.opacity = facing * sweep * .9;
        material.color.set(index % 3 ? 0xffd9a1 : 0xb8e6ff).multiplyScalar(3.5 + sweep * 4);
        material.rotation = reducedMotion ? .2 : progress * .8 + index * .3;
        sprite.scale.setScalar(width * (.8 + sweep * .5));
      }
    },
    dispose() { texture.dispose(); entries.forEach(({sprite, material}) => { sprite.removeFromParent(); material.dispose(); }); },
  };
}
