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

// The final orbit moves only the camera. Its endpoints exactly match the
// completed reveal, so scrolling back retraces the same path without a jump.
export function sampleOrbitPose(progress, isMobile = false) {
  const pose = samplePose(1, isMobile);
  const p = THREE.MathUtils.clamp(progress, 0, 1);
  if (p === 0 || p === 1) return pose;
  const t = p * p * (3 - 2 * p);
  const [x, y, z] = pose.eye.map((v, i) => v - pose.target[i]);
  const sideView = Math.sin(Math.PI * 2 * t) ** 2;
  const radius = Math.hypot(x, z) * (1 + sideView * (isMobile ? 1.6 : .12));
  const angle = Math.atan2(x, z) + Math.PI * 2 * t;
  pose.eye = [
    pose.target[0] + Math.sin(angle) * radius,
    pose.target[1] + y + Math.sin(Math.PI * p) ** 2 * .65,
    pose.target[2] + Math.cos(angle) * radius,
  ];
  return pose;
}

export function frameOrbitPose(pose, bounds, aspect, fov, progress) {
  const target = new THREE.Vector3(...pose.target);
  const direction = new THREE.Vector3(...pose.eye).sub(target);
  const radius = direction.length(); direction.normalize();
  const right = new THREE.Vector3(0, 1, 0).cross(direction).normalize();
  const up = direction.clone().cross(right);
  const vertical = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  const horizontal = vertical * aspect;
  let required = radius;
  for (const x of [bounds.min[0], bounds.max[0]]) for (const y of [bounds.min[1], bounds.max[1]]) for (const z of [bounds.min[2], bounds.max[2]]) {
    const corner = new THREE.Vector3(x, y, z).sub(target);
    const depth = corner.dot(direction);
    required = Math.max(required, depth + Math.abs(corner.dot(right)) / horizontal * 1.08, depth + Math.abs(corner.dot(up)) / vertical * 1.08);
  }
  // Dolly out before the side/rear inspection, then restore the exact reveal
  // framing. Angle and elevation still follow the same reversible orbit.
  const ease = value => { const t = THREE.MathUtils.clamp(value, 0, 1); return t * t * (3 - 2 * t); };
  const blend = ease(progress / .1) * ease((1 - progress) / .1);
  pose.eye = target.addScaledVector(direction, THREE.MathUtils.lerp(radius, required, blend)).toArray();
  return pose;
}
