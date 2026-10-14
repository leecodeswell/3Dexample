import * as THREE from 'three';

// Keep the dial and mechanism facing the camera through the entire reveal.
// Three-quarter angles expose the layer spacing without a rear-facing turn.
const poses = [
  { at: 0, rotation: [-.10, -.25, -.14], eye: [1.4, .7, 5.8], target: [0, .05, -.55] },
  { at: .22, rotation: [.12, .48, -.06], eye: [1, .5, 6.4], target: [0, .05, -.2] },
  { at: .46, rotation: [.24, .70, .10], eye: [1.3, 1.0, 7.5], target: [0, .1, .25] },
  { at: .70, rotation: [.18, .65, -.08], eye: [1, .65, 8.0], target: [0, .05, .30] },
  { at: 1, rotation: [-.10, .55, -.14], eye: [1.4, .65, 8.2], target: [0, .05, .5] },
];
export function samplePose(progress, isMobile = false) {
  const p = THREE.MathUtils.clamp(progress, 0, 1);
  let a = poses[0], b = poses[1];
  for (let i = 1; i < poses.length; i++) {
    a = poses[i - 1]; b = poses[i]; if (p <= b.at) break;
  }
  let t = THREE.MathUtils.clamp((p - a.at) / (b.at - a.at), 0, 1);
  t = t * t * (3 - 2 * t);
  const interpolate = key => a[key].map((v, i) => THREE.MathUtils.lerp(v, b[key][i], t));
  const eye = interpolate('eye');
  if (isMobile) { eye[0] *= .7; eye[2] *= 1.22; }
  return { rotation: interpolate('rotation'), eye, target: interpolate('target') };
}
