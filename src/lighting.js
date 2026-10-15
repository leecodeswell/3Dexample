import * as THREE from 'three';

// Broad sources preserve readable metal; thin strips draw traveling highlights.
export function createCinematicLighting(scene) {
  const sources = [
    [0xffbb68, 14, .16, 6],
    [0x69bbff, 12, .12, 5],
    [0xfff1d2, 10, 5, .16],
    [0xff672a, 9, 2, 3],
  ].map(([color, intensity, width, height]) => {
    const light = new THREE.RectAreaLight(color, intensity, width, height);
    scene.add(light);
    return light;
  });
  const target = new THREE.Vector2(), current = new THREE.Vector2();
  let previous = '';
  return {
    aim(x, y) { target.set(x, y); },
    update(progress, orbit, dt, enabled, reducedMotion, bloom) {
      current.lerp(reducedMotion ? new THREE.Vector2() : target, 1 - Math.exp(-Math.min(dt, .1) * 5));
      const p = reducedMotion ? .25 : progress;
      const turn = reducedMotion ? 0 : orbit;
      const signature = [p, turn, current.x, current.y, enabled].map(v => typeof v === 'number' ? v.toFixed(4) : v).join(':');
      if (signature === previous) return false;
      previous = signature;
      const sweep = p * Math.PI * 1.6 + turn * Math.PI * 2;
      const reveal = THREE.MathUtils.smoothstep(p, .12, .8);
      const aimX = current.x * 1.3, aimY = current.y * .8;
      sources[0].position.set(-3.8 + Math.sin(sweep) * 2 + aimX, 2.8 + aimY, 4.2);
      sources[1].position.set(3.8 + aimX, -1.4 + Math.sin(sweep + 1) * 2 + aimY, 2.8);
      sources[2].position.set(Math.sin(sweep * .7) * 3, 4.2, 1 + Math.cos(sweep) * 3);
      sources[3].position.set(-2 + Math.cos(sweep) * 3, -3, -2.5);
      sources.forEach(light => { light.visible = enabled; light.lookAt(0, 0, p * .6); });
      sources[0].intensity = 12 + Math.sin(sweep) ** 2 * 10;
      sources[1].intensity = 9 + reveal * 10;
      sources[2].intensity = 8 + Math.sin(p * Math.PI) ** 4 * 16;
      sources[3].intensity = 7 + reveal * 12;
      bloom.strength = enabled ? .38 + reveal * .3 : .014;
      bloom.radius = .8;
      bloom.threshold = enabled ? .85 : 3.5;
      return true;
    },
  };
}
