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

export const ORBIT_SPAN = 1 / 3;
export const ORBIT_DURATION = 9;
const ORBIT_SETTLE = .18;

// A single gentle pullback precedes the turn. The turn itself keeps a fixed
// radius, elevation and target, with no angle-dependent zoom or vertical bob.
export function sampleOrbitPose(progress, isMobile = false) {
  const pose = samplePose(1, isMobile);
  const p = THREE.MathUtils.clamp(progress, 0, 1);
  if (p <= ORBIT_SETTLE || p === 1) return pose;
  const turn = (p - ORBIT_SETTLE) / (1 - ORBIT_SETTLE);
  const t = turn * turn * (3 - 2 * turn);
  const [x, y, z] = pose.eye.map((v, i) => v - pose.target[i]);
  const radius = Math.hypot(x, z);
  const angle = Math.atan2(x, z) + Math.PI * 2 * t;
  pose.eye = [pose.target[0] + Math.sin(angle) * radius, pose.target[1] + y, pose.target[2] + Math.cos(angle) * radius];
  return pose;
}

export function frameOrbitPose(pose, bounds, aspect, fov, progress) {
  const target = new THREE.Vector3(...pose.target);
  const direction = new THREE.Vector3(...pose.eye).sub(target);
  const radius = direction.length(); direction.normalize();
  const sinElevation = direction.y;
  const cosElevation = Math.sqrt(1 - sinElevation * sinElevation);
  const vertical = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  const horizontal = vertical * aspect;
  let required = radius;
  // Fit every azimuth at once, rather than changing distance at each angle.
  // These bounds maximize the horizontal and vertical frustum constraints
  // analytically over a full revolution at the fixed viewing elevation.
  for (const x of [bounds.min[0], bounds.max[0]]) for (const y of [bounds.min[1], bounds.max[1]]) for (const z of [bounds.min[2], bounds.max[2]]) {
    const h = Math.hypot(x - target.x, z - target.z), height = y - target.y;
    required = Math.max(required, h * Math.hypot(cosElevation, 1.08 / horizontal) + height * sinElevation);
    for (const side of [-1, 1]) {
      const depth = side * h * cosElevation + height * sinElevation;
      const up = height * cosElevation - side * h * sinElevation;
      required = Math.max(required, depth + Math.abs(up) * 1.08 / vertical);
    }
  }
  const t = THREE.MathUtils.clamp(progress / ORBIT_SETTLE, 0, 1);
  const settle = t * t * (3 - 2 * t);
  pose.eye = target.addScaledVector(direction, THREE.MathUtils.lerp(radius, required, settle)).toArray();
  return pose;
}
