import './style.css';
import modelConfig from './model-config.json';
import { createTreatments } from './materials.js';
import { createContactShading } from './contact-shading.js';
import { createStudioBackdrop } from './backdrop.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { samplePose, sampleOrbitPose, frameOrbitPose, ORBIT_SPAN, ORBIT_DURATION } from './choreography.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
gsap.ticker.lagSmoothing(0);
const $ = (s) => document.querySelector(s);
const canvas = $('#watch-canvas'), stage = $('#stage');
const slider = $('#explosion-slider'), output = $('#explosion-value');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = () => innerWidth <= 700;
const state = { sequence: 0, progress: 0, orbit: 0, ready: false, cinematic: !reducedMotion, labels: true, studio: true, brown: true, finish: true, interacting: false, focused: false, manualView: false };
const parts = new Map(), pickable = [], labels = [];
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const chapters = [
  { eyebrow: 'TEMPUS, IN FORMA', title: 'Tempus.<br><em>Ex machina.</em>', description: 'In singulis partibus, universum.<br>Forma, materia et motus in perfecta concordia.', name: 'FORMA PERFECTA', action: 'EXPLORA OPUS' },
  { eyebrow: 'ANATOMIA TEMPORIS', title: 'Intus.<br><em>Mirabilia.</em>', description: 'Aurum, rotae, motus.<br>Ars mechanica sub lumine revelatur.', name: 'ORDO ET MATERIA', action: 'REVELA PARTES' },
  { eyebrow: 'ESSENTIA REVELATA', title: 'Omnia.<br><em>In uno.</em>', description: 'Vitrum, argentum, lumen.<br>Perfectio ex singulis partibus nascitur.', name: 'ESSENTIA REVELATA', action: 'REDI AD INITIUM' },
];
let watchRoot;
let expandedBounds;
let renderDirty = true;
let chapter = -1, renderer, composer, camera, controls, scene, bloom, contactShading, studioQuality, explosionTween, cameraTween;
let animationFrame, scrollTrigger, lastInteraction = 0, clickStart, disposed = false;
let scrollIntent = true;
const cinematicTarget = new THREE.Vector3();
const cinematicPosition = new THREE.Vector3();
const treatments = createTreatments();
const treatedMeshes = [];
const glass = [];
function updateTreatments() {
  renderDirty = true;
  for (const record of treatedMeshes) {
    record.mesh.material = record.variants.map(v => {
      const useStudio = v.original.name === 'Glass' ? state.studio : state.finish;
      return useStudio ? (state.brown ? v.brownStudio : v.studio) : (state.brown ? v.brown : v.original);
    });
    if (!record.array) record.mesh.material = record.mesh.material[0];
  }
}

function setChapter(index) {
  if (index === chapter) return;
  chapter = index;
  const data = chapters[index];
  const editorial = $('#editorial');
  gsap.killTweensOf(editorial);
  const update = () => {
    $('#chapter-eyebrow').textContent = data.eyebrow;
    $('#chapter-title').innerHTML = data.title;
    $('#chapter-description').innerHTML = data.description;
    $('#chapter-number').textContent = String(index + 1).padStart(2, '0');
    $('#chapter-name').textContent = data.name;
    $('#explore-text').textContent = data.action;
    $('#page-current').textContent = String(index + 1).padStart(2, '0');
    document.querySelectorAll('.nav-link').forEach((e, i) => e.classList.toggle('active', i === index));
    document.querySelectorAll('.page-bars i').forEach((e, i) => e.classList.toggle('active', i === index));
  };
  if (chapter === 0 && !state.ready || reducedMotion) { update(); return; }
  gsap.to(editorial, { opacity: 0, y: -8, duration: .2, onComplete: () => {
    update(); gsap.fromTo(editorial, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .6, ease: 'power2.out' });
  } });
}

function displayProgress(p) {
  slider.value = Math.round(p * 1000);
  slider.style.setProperty('--progress', `${p * 100}%`);
  output.textContent = `${String(Math.round(p * 100)).padStart(3, '0')}%`;
  const fraction = revealDistance() / (revealDistance() + $('#circum').offsetHeight);
  $('#scroll-progress-fill').style.width = `${(p * fraction + state.orbit * (1 - fraction)) * 100}%`;
  $('#sequence-title').textContent = state.orbit > 0 ? 'CIRCUMSPECTIO · 360°' : 'ANATOMIA TEMPORIS';
  setChapter(p < .30 ? 0 : p < .74 ? 1 : 2);
}

function smoothStep(start, end, p) {
  const x = THREE.MathUtils.clamp((p - start) / (end - start), 0, 1);
  return x * x * (3 - 2 * x);
}

const definitions = {
  case: { title: 'Corpus', subtitle: 'I / CORPUS', description: 'Argentum in forma. Corpus et lunula, in perfecta concordia.', offset: [0, 0, -.42], range: [.03, .72], anchor: [1.15, 0, 0] },
  dial: { title: 'Tabula', subtitle: 'IV / TABULA', description: 'Brunneum profundum. Numeri et indices una cum tabula moventur.', offset: [.55, .6, 1.55], range: [.025, .59], anchor: [.95, 0, .1] },
  glass: { title: 'Vitrum', subtitle: 'II / VITRUM', description: 'Lumen transit. Vitrum a corpore leniter separatur.', offset: [-.9, .55, 3.6], range: [0, .40], anchor: [-.78, 0, 0] },
  hour: { title: 'Hora', subtitle: 'III / HORA', description: 'Parva sagitta, horae indicium. Motus in proprio axe.', offset: [-.12, .05, 1.8], range: [.012, .57], anchor: [-.45, 0, -.1] },
  minute: { title: 'Minuta', subtitle: 'III / MINUTA', description: 'Longa sagitta, subtilis mensura. Pars singularis et libera.', offset: [.12, -.03, 2.2], range: [.009, .58], anchor: [0, 0, -.55] },
  second: { title: 'Secunda', subtitle: 'III / SECUNDA', description: 'Momentum fugit. Tertia sagitta separatim revelatur.', offset: [0, .09, 2.6], range: [.005, .58], anchor: [.2, .2, .1] },
  hub: { title: 'Axis', subtitle: 'III / AXIS', description: 'In centro, concordia. Axis sagittas in unum colligit.', offset: [0, 0, 1.72], range: [.012, .57], anchor: [0, 0, 0] },
  crown: { title: 'Corona', subtitle: 'V / CORONA', description: 'Corona ad latus. Parva forma, magna diligentia.', offset: [.9, 0, .06], range: [.10, .94], anchor: [1.05, 0, 0] },
  bars: { title: 'Ansae', subtitle: 'V / ANSAE', description: 'Ansae corpus et armillam coniungunt. Forma et materia in concordia.', offset: [.55, 0, -.15], range: [.11, .94], anchor: [1.05, 0, 0] },
  bracelet: { title: 'Armilla', subtitle: 'VI / ARMILLA', description: 'Metallum circa carpi formam. Articuli in uno reticulo coniuncti.', offset: [0, 0, -.86], range: [.07, .95], anchor: [.6, -.7, -1.3] },
  backplate: { title: 'Fundus', subtitle: 'VII / FUNDUS', description: 'Pars posterior. Metallum et textura sub lumine revelantur.', offset: [.12, 0, -1.25], range: [.12, .98], anchor: [.7, 0, -.3] },
  clasp: { title: 'Fibula', subtitle: 'VI / FIBULA', description: 'Ultima pars, perfecta clausura. Fibula et parvus cardo simul moventur.', offset: [0, 0, -1.35], range: [.13, 1], anchor: [.3, 0, -2.1] },
};

Object.assign(definitions, {
  movement: { title: 'Machina', subtitle: 'IV / MACHINA', description: 'Intus, ars vivit. Rotae, axes et materia in concordia.', offset: [0, 0, .35], range: [.08, .78], anchor: [.45, -.15, .08] },
  bridges: { title: 'Pontes', subtitle: 'V / PONTES', description: 'Pontes et cochleae. Forma subtilis motum custodit.', offset: [.18, .12, 1.38], range: [.09, .88], anchor: [.55, .3, .08] },
  tourbillon: { title: 'Tourbillon', subtitle: 'VI / TOURBILLON', description: 'In parva machina, perpetuus motus. Aurum et aequilibrium.', offset: [0, .55, 1.1], range: [.10, .92], anchor: [.05, .1, 0] },
});
for (let i = 0; i < 16; i++) {
  const angle = i / 16 * Math.PI * 2;
  definitions[`gear${String(i + 1).padStart(2, '0')}`] = {
    title: `Rota ${String(i + 1).padStart(2, '0')}`, subtitle: `VII / ROTA ${String(i + 1).padStart(2, '0')}`,
    description: 'Dentes, axis, aurum. Una pars in magno motu.',
    offset: [Math.cos(angle) * (.48 + i % 3 * .18), Math.sin(angle) * .5, .68 + i % 5 * .12],
    range: [.10 + i % 4 * .01, .97], anchor: [.12, 0, 0], spin: (i % 2 ? -1 : 1) * (1.0 + i % 3 * .25),
  };
}

function applyExplosion() {
  state.progress = THREE.MathUtils.clamp(state.sequence, 0, 1);
  state.orbit = THREE.MathUtils.clamp((state.sequence - 1) / ORBIT_SPAN, 0, 1);
  renderDirty = true;
  for (const part of parts.values()) {
    const t = smoothStep(...part.range, state.progress);
    part.group.position.copy(part.origin).addScaledVector(part.offset, t);
    // Lift at the lens center, then turn it edge-on and drift it away from the
    // dial. Refraction remains clear; the softbox never fills a frontal disc.
    if (part.group.name === 'component_glass') {
      const tilt = smoothStep(0, .32, state.progress);
      part.group.rotation.set(tilt * .18, tilt === 0 ? 0 : -tilt * 1.08, 0);
    }
  }
  for (const [key, part] of parts) {
    if (key.startsWith('gear')) {
      const phase = smoothStep(.10, 1, state.progress);
      part.group.rotation.z = phase === 0 ? 0 : phase * part.spin * Math.PI * 2;
    }
    if (key === 'tourbillon') part.group.rotation.z = smoothStep(.10, 1, state.progress) * Math.PI * 2;
  }
  displayProgress(state.progress);
  const pose = state.orbit > 0 ? sampleOrbitPose(state.orbit, mobile()) : samplePose(state.progress, mobile());
  if (watchRoot) watchRoot.rotation.set(...(state.cinematic ? pose.rotation : samplePose(0).rotation));
  if (state.progress < 1) expandedBounds = null;
  if (watchRoot && state.orbit > 0) {
    const rotation = watchRoot.rotation.toArray().slice(0, 3).join(',');
    if (!expandedBounds || expandedBounds.rotation !== rotation) {
      watchRoot.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(watchRoot);
      expandedBounds = { min: box.min.toArray(), max: box.max.toArray(), rotation };
    }
    frameOrbitPose(pose, expandedBounds, camera.aspect, camera.fov, state.orbit);
  }
  cinematicPosition.fromArray(pose.eye);
  cinematicTarget.fromArray(pose.target);
  controls.maxDistance = Math.max(19, cinematicPosition.distanceTo(cinematicTarget) * 1.05);

}

function stopPlayback() {
  explosionTween?.kill(); explosionTween = null;
  $('#play-explosion').textContent = '▷';
  $('#play-explosion').setAttribute('aria-label', 'Play exploded view');
}

function closeInspector() {
  $('#inspector').hidden = true; state.focused = false;
  $('#editorial').style.visibility = '';
}

function showPart(key) {
  const part = parts.get(key); if (!part) return;
  closeInspector();
  $('#inspector').hidden = false;
  $('#editorial').style.visibility = 'hidden';
  $('#inspector-title').textContent = part.title;
  $('#inspector-description').textContent = part.description;
  $('#focus-part').onclick = () => focusPart(key);
}

function focusPart(key) {
  const part = parts.get(key); if (!part) return;
  const box = new THREE.Box3().setFromObject(part.group);
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(box.getSize(new THREE.Vector3()).length() * .75, .35);
  const direction = camera.position.clone().sub(controls.target).normalize();
  const destination = center.clone().addScaledVector(direction, radius * 2.3);
  cameraTween?.kill(); state.focused = true;
  cameraTween = gsap.timeline().to(camera.position, { x: destination.x, y: destination.y, z: destination.z, duration: reducedMotion ? 0 : 1.5, ease: 'power3.inOut' }, 0)
    .to(controls.target, { x: center.x, y: center.y, z: center.z, duration: reducedMotion ? 0 : 1.5, ease: 'power3.inOut' }, 0);
}

async function loadWatch() {
  const loader = new GLTFLoader();
  watchRoot = new THREE.Group(); scene.add(watchRoot);
  watchRoot.rotation.set(...samplePose(0).rotation);
  const sourceWorld = new Map();
  const [environment] = await Promise.all([new HDRLoader().loadAsync(modelConfig.environment), treatments.ready]);
  environment.mapping = THREE.EquirectangularReflectionMapping;
  const generator = new THREE.PMREMGenerator(renderer);
  const reflectionMap = generator.fromEquirectangular(environment);
  scene.environment = reflectionMap.texture; scene.environmentIntensity = .85;
  environment.dispose(); generator.dispose();
  const gltf = await loader.loadAsync(modelConfig.model.asset, e => {
    if (e.total) $('#load-percent').textContent = `${Math.round(e.loaded / e.total * 100)}%`;
  });
  watchRoot.add(gltf.scene); scene.updateMatrixWorld(true);
  const meshes = []; gltf.scene.traverse(o => { if (o.isMesh) meshes.push(o); });
  for (const mesh of meshes) sourceWorld.set(mesh, mesh.matrixWorld.clone());
  for (const mesh of meshes) {
    // Blender may put object extras on a parent when a mesh has multiple materials.
    let owner = mesh;
    while (!owner.userData.watch_component && owner.parent) owner = owner.parent;
    const key = owner.userData.watch_component, source = owner.userData.watch_source;
    if (!definitions[key]) throw new Error(`Unmapped derivative component: ${mesh.name}`);
    if (!parts.has(key)) {
      const group = new THREE.Group(); group.name = `component_${key}`; watchRoot.add(group);
      if (owner.userData.watch_pivot) group.position.fromArray(owner.userData.watch_pivot);
      const def = definitions[key];
      parts.set(key, { ...def, group, origin: group.position.clone(), offset: new THREE.Vector3(...def.offset), range: def.range });
    }
    const group = parts.get(key).group;
    group.updateWorldMatrix(true, false);
    const local = group.matrixWorld.clone().invert().multiply(sourceWorld.get(mesh));
    group.add(mesh); mesh.matrixAutoUpdate = false; mesh.matrix.copy(local); mesh.matrixWorldNeedsUpdate = true;
    mesh.userData.part = key; mesh.userData.source = source; pickable.push(mesh);
    const array = Array.isArray(mesh.material), materials = array ? mesh.material : [mesh.material];
    treatedMeshes.push({ mesh, array, variants: materials.map(m => treatments.variants(m, mesh.geometry.hasAttribute('uv'), key)) });
    mesh.castShadow = mesh.receiveShadow = !materials.some(m => m.name === 'Glass');
    if (materials.some(m => m.name === 'Glass')) { mesh.renderOrder = 2; glass.push(mesh); }
  }
  if (meshes.length !== modelConfig.model.meshCount) throw new Error('Photoreal component coverage failed.');
  updateTreatments();
  // Seven restrained labels; all actual meshes remain available by clicking.
  for (const key of ['glass', 'dial', 'gear01', 'movement', 'bridges', 'case', 'bracelet']) {
    const el = document.createElement('div'); el.className = 'part-label';
    const button = document.createElement('button'); button.textContent = parts.get(key).subtitle;
    button.setAttribute('aria-label', `Inspect ${key}`); button.tabIndex = -1;
    button.addEventListener('click', () => showPart(key)); el.append(button); $('#labels').append(el);
    labels.push({ key, el, button, point: new THREE.Vector3(...definitions[key].anchor) });
  }
  state.ready = true; slider.disabled = false;
  applyExplosion(); controls.target.copy(cinematicTarget); camera.position.copy(cinematicPosition); controls.update();
  $('#loading').hidden = true;
  canvas.style.opacity = '1';
  gsap.to('#watch-poster', { opacity: 0, duration: reducedMotion ? 0 : .65, delay: .1, onComplete: () => { $('#watch-poster').hidden = true; } });
  window.__watchShowcase = {
    get progress() { return state.progress; },
    get orbitProgress() { return state.orbit; },
    get cinematicCameraPosition() { return cinematicPosition.toArray(); },
    get expandedBounds() { return expandedBounds; },
    get parts() { return [...parts.keys()]; },
    get meshCount() { return pickable.length; },
    get modelRotation() { return watchRoot.rotation.toArray().slice(0, 3); },
    get gearRotations() { return Object.fromEntries([...parts].filter(([k]) => k.startsWith('gear')).map(([k,p]) => [k,p.group.rotation.z])); },
    get crystalRotation() { return parts.get('glass').group.rotation.toArray().slice(0, 3); },
    get sourceCounts() { return Object.fromEntries(['exterior', 'mechanism', 'design'].map(s => [s, pickable.filter(m => m.userData.source === s).length])); },
    get faceDepths() {
      scene.updateMatrixWorld(true); const inverse = watchRoot.matrixWorld.clone().invert();
      return Object.fromEntries([...parts].map(([key,part]) => {
        const box = new THREE.Box3(); part.group.traverse(m => { if (!m.isMesh) return;
          m.geometry.computeBoundingBox(); box.union(m.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(m.matrixWorld)));
        }); return [key, [box.min.z, box.max.z]];
      }));
    },
    get appearance() { return { brown: state.brown, finish: state.finish, studioGlass: state.studio }; },
    get rendering() { return { environment: modelConfig.environment, contactShading: !!contactShading?.enabled, shadows: renderer.shadowMap.enabled, opaqueMeshes: pickable.length - glass.length, glassMeshes: glass.length }; },
    get finishProfiles() { return [...new Set(treatedMeshes.flatMap(r => r.variants.map(v => v.profile)).filter(Boolean))]; },
    get cameraPosition() { return camera.position.toArray(); },
    get sourceTransformsMatch() { scene.updateMatrixWorld(true); return [...sourceWorld].every(([mesh, matrix]) => mesh.matrixWorld.elements.every((value, i) => Math.abs(value - matrix.elements[i]) < 1e-6)); },
    get assembled() { return [...parts.values()].every(p => p.group.position.distanceTo(p.origin) < 1e-8); },
    get positions() { return Object.fromEntries([...parts].map(([k, p]) => [k, p.group.position.toArray()])); },
    get ready() { return state.ready; },
  };
}

function resize() {
  if (!renderer) return;
  const { width, height } = stage.getBoundingClientRect();
  camera.aspect = width / height; camera.updateProjectionMatrix();
  renderer.setSize(width, height, false); composer.setSize(width, height);
  // Responsive FOV keeps the entire original bracelet visible at every breakpoint.
  camera.fov = mobile() ? 42 : 36; camera.updateProjectionMatrix();
  applyExplosion();
  if (!state.interacting && !state.focused) {
    camera.position.copy(cinematicPosition); controls.target.copy(cinematicTarget);
  }
}

function updateLabels() {
  const stageRect = stage.getBoundingClientRect();
  const visible = state.labels && state.progress > .24;
  $('#labels').setAttribute('aria-hidden', String(!visible));
  const placed = [];
  for (const label of labels) {
    const part = parts.get(label.key);
    const point = label.point.clone(); part.group.localToWorld(point); point.project(camera);
    let x = stageRect.left + (point.x + 1) / 2 * stageRect.width + (mobile() ? 28 : 48);
    let y = stageRect.top + (1 - point.y) / 2 * stageRect.height;
    const onScreen = point.z < 1 && point.z > -1 && x > stageRect.left + 10 && x < innerWidth - 85 && y > 170 && y < innerHeight - 170;
    let show = visible && onScreen && !state.focused;
    if (mobile() && !['tourbillon', 'movement', 'bracelet'].includes(label.key)) show = false;
    if (placed.some(p => Math.abs(p.x - x) < 100 && Math.abs(p.y - y) < 23)) show = false;
    if (show) placed.push({ x, y });
    label.el.style.left = `${x}px`; label.el.style.top = `${y}px`;
    label.el.style.opacity = show ? smoothStep(.24, .45, state.progress) * .85 : 0;
    label.button.tabIndex = show ? 0 : -1;
    label.button.style.pointerEvents = show ? 'auto' : 'none';
  }
}

function animate() {
  if (disposed) return;
  animationFrame = requestAnimationFrame(animate);
  const dt = clock.getDelta();
  if (state.ready) {
    const canFollow = state.cinematic && !state.manualView && !state.interacting && !state.focused && !controls.autoRotate && performance.now() - lastInteraction > 4500;
    if (canFollow && !cameraTween?.isActive()) {
      if (state.orbit > 0) {
        // Sequence scrubbing already eases the angular path. Follow its sampled
        // radius instead of lerping a chord through the model on a fast scroll.
        camera.position.copy(cinematicPosition); controls.target.copy(cinematicTarget);
      } else {
        const alpha = 1 - Math.exp(-dt * 3.5);
        camera.position.lerp(cinematicPosition, alpha);
        controls.target.lerp(cinematicTarget, alpha);
      }
    }
    controls.update(Math.min(dt, .25)); scene.updateMatrixWorld(); updateLabels();
  }
  if (renderDirty) { composer.render(); renderDirty = false; }
}

function setupScene() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .65;
  renderer.setClearColor(0x141613, 1);
  const gl = renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
  const softwareGPU = debug && /SwiftShader|llvmpipe|Software/i.test(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL));
  studioQuality = new URLSearchParams(location.search).get('quality') === 'studio' || (!softwareGPU && !mobile());
  renderer.shadowMap.enabled = studioQuality; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  scene.background = createStudioBackdrop(renderer.toneMappingExposure);
  camera = new THREE.PerspectiveCamera(38, 1, .05, 70);
  controls = new OrbitControls(camera, canvas);
  controls.addEventListener('change', () => { renderDirty = true; });
  controls.enableDamping = true; controls.dampingFactor = .07; controls.enablePan = false;
  controls.minDistance = .65; controls.maxDistance = 19; controls.autoRotateSpeed = .45;
  controls.enableZoom = true; controls.mouseButtons.RIGHT = THREE.MOUSE.DOLLY;
  canvas.style.touchAction = 'pan-y';
  // Preserve page wheel scrolling; pinch and right-drag retain camera zoom.
  const wheelHandler = (event) => { if (!event.ctrlKey) event.stopImmediatePropagation(); };
  canvas.addEventListener('wheel', wheelHandler, { capture: true, passive: true });
  controls.touches.ONE = THREE.TOUCH.ROTATE; controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  controls.addEventListener('start', () => {
    state.interacting = true; state.manualView = true; cameraTween?.kill(); lastInteraction = performance.now(); document.body.classList.add('dragging');
  });
  controls.addEventListener('end', () => { state.interacting = false; lastInteraction = performance.now(); document.body.classList.remove('dragging'); });
  RectAreaLightUniformsLib.init();
  const softbox = new THREE.RectAreaLight(0xfff0d8, .9, 3, 5);
  softbox.position.set(-4, 4, 3); softbox.lookAt(0, 0, 0); scene.add(softbox);
  const key = new THREE.DirectionalLight(0xffedce, .85); key.position.set(-3, 6, 7);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.normalBias = .0008; key.shadow.bias = -.0001;
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .1, far: 25 });
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xc7dded, .22); fill.position.set(5, -1, 3); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xf2d1a0, .90); rim.position.set(-4, -3, -2); scene.add(rim);
  scene.add(new THREE.AmbientLight(0xd3dcc5, .04));
  composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
  if (studioQuality) { contactShading = createContactShading(scene, camera, glass); composer.addPass(contactShading); }
  // Keep an invalid imported tangent or a half-float overflow from spreading
  // across the entire image through bloom's blur pyramid.
  composer.addPass(new ShaderPass({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
      void main(){ vec4 c=texture2D(tDiffuse,vUv);
        if(any(isnan(c.rgb)) || any(isinf(c.rgb))) c.rgb=vec3(0.0);
        gl_FragColor=vec4(clamp(c.rgb,vec3(0.0),vec3(16.0)),c.a);
      }`,
  }));
  bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .014, .4, 3.5); composer.addPass(bloom);
  composer.addPass(new ShaderPass({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
      void main(){ vec4 c=texture2D(tDiffuse,vUv); vec2 p=vUv-.5;
      float vignette=1.0-.20*dot(p,p);
      float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5;
      c.rgb=c.rgb*vec3(1.025,1.0,.975)*vignette+grain*.0007*c.a;
      gl_FragColor=vec4(max(c.rgb,vec3(0.0)),c.a); }`,
  }));
  composer.addPass(new OutputPass());
  resize(); animate();
  window.addEventListener('resize', resize);
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault(); $('#webgl-note').textContent = '3D rendering paused. Reload to restore the experience.';
    cancelAnimationFrame(animationFrame);
  });
  canvas.addEventListener('pointerdown', (e) => { clickStart = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!state.ready || !clickStart || Math.hypot(e.clientX - clickStart.x, e.clientY - clickStart.y) > 5) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(pickable, false)[0];
    if (hit) showPart(hit.object.userData.part);
  });
}

function revealDistance() {
  // The first three chapters keep their original scroll distance. The fourth
  // section adds the orbit after the complete reveal rather than compressing it.
  return Math.max(1, $('#circum').offsetTop - innerHeight);
}

function setupInteraction() {
  setChapter(0); $('#camera-motion').checked = state.cinematic;
  // Establish scroll ownership before ScrollTrigger handles that same event,
  // including a scrollbar jump immediately after manual slider control.
  window.addEventListener('scroll', () => { scrollIntent = true; }, { passive: true, capture: true });
  scrollTrigger = ScrollTrigger.create({
    trigger: '.scroll-track', start: 'top top', end: 'bottom bottom',
    onUpdate: (self) => {
      if (!state.ready || !scrollIntent) return;
      stopPlayback(); closeInspector(); state.manualView = false;
      gsap.killTweensOf(state);
      const distance = self.scroll() - self.start;
      const reveal = revealDistance();
      const sequence = distance <= reveal ? distance / reveal : 1 + ORBIT_SPAN * (distance - reveal) / $('#circum').offsetHeight;
      gsap.to(state, { sequence: THREE.MathUtils.clamp(sequence, 0, 1 + ORBIT_SPAN), duration: reducedMotion ? 0 : .55, ease: 'power2.out', onUpdate: applyExplosion });
    },
  });
  // Only deliberate scrolling takes ownership after manual slider input.
  window.addEventListener('wheel', () => { scrollIntent = true; }, { passive: true, capture: true });
  window.addEventListener('touchmove', (event) => { if (!stage.contains(event.target)) scrollIntent = true; }, { passive: true });
  window.addEventListener('keydown', (e) => {
    if (['PageDown', 'PageUp', 'Home', 'End', 'ArrowDown', 'ArrowUp', ' '].includes(e.key) && !['INPUT', 'BUTTON'].includes(document.activeElement?.tagName)) scrollIntent = true;
    if (e.key === 'Escape') { $('#settings-panel').hidden = true; $('#settings-toggle').setAttribute('aria-expanded', 'false'); closeInspector(); }
  });
  slider.addEventListener('input', () => {
    if (!state.ready) return;
    scrollIntent = false; stopPlayback(); closeInspector(); state.manualView = false; gsap.killTweensOf(state);
    state.sequence = Number(slider.value) / 1000; applyExplosion();
  });
  slider.addEventListener('pointerdown', () => { scrollIntent = false; stopPlayback(); });
  $('#play-explosion').addEventListener('click', () => {
    if (!state.ready) return;
    if (explosionTween?.isActive()) { stopPlayback(); return; }
    scrollIntent = false; closeInspector(); state.manualView = false; gsap.killTweensOf(state);
    const destination = state.progress > .99 ? 0 : 1;
    $('#play-explosion').textContent = 'II'; $('#play-explosion').setAttribute('aria-label', 'Pause exploded view');
    const revealDuration = reducedMotion ? .4 : Math.max(2, Math.abs(destination - state.progress) * 9);
    explosionTween = gsap.timeline({ onUpdate: applyExplosion, onComplete: stopPlayback });
    if (destination === 0) {
      if (state.orbit > 0) explosionTween.to(state, { sequence: 1, duration: state.cinematic ? state.orbit * ORBIT_DURATION : 0, ease: 'none' });
      explosionTween.to(state, { sequence: 0, duration: revealDuration, ease: 'sine.inOut' });
    } else {
      explosionTween.to(state, { sequence: 1, duration: revealDuration, ease: 'sine.inOut' });
      if (state.cinematic) explosionTween.to(state, { sequence: 1 + ORBIT_SPAN, duration: ORBIT_DURATION, ease: 'none' });
    }
  });
  $('#reset-view').addEventListener('click', () => {
    closeInspector(); controls.autoRotate = false; $('#auto-rotate').setAttribute('aria-pressed', 'false');
    lastInteraction = 0; state.focused = false; state.manualView = false; cameraTween?.kill();
    cameraTween = gsap.timeline().to(camera.position, { x: cinematicPosition.x, y: cinematicPosition.y, z: cinematicPosition.z, duration: reducedMotion ? 0 : 1.4, ease: 'power3.inOut' }, 0)
      .to(controls.target, { x: cinematicTarget.x, y: cinematicTarget.y, z: cinematicTarget.z, duration: reducedMotion ? 0 : 1.4, ease: 'power3.inOut' }, 0);
  });
  $('#auto-rotate').addEventListener('click', () => { controls.autoRotate = !controls.autoRotate; $('#auto-rotate').setAttribute('aria-pressed', String(controls.autoRotate)); });
  $('#settings-toggle').addEventListener('click', () => { const panel = $('#settings-panel'); panel.hidden = !panel.hidden; $('#settings-toggle').setAttribute('aria-expanded', String(!panel.hidden)); });
  $('#settings-close').addEventListener('click', () => { $('#settings-panel').hidden = true; $('#settings-toggle').setAttribute('aria-expanded', 'false'); $('#settings-toggle').focus(); });
  $('#studio-glass').addEventListener('change', (e) => { state.studio = e.target.checked; updateTreatments(); });
  $('#brown-finish').addEventListener('change', (e) => { state.brown = e.target.checked; updateTreatments(); });
  $('#cinematic-finish').addEventListener('change', (e) => { state.finish = e.target.checked; updateTreatments(); });
  $('#show-labels').addEventListener('change', (e) => { state.labels = e.target.checked; });
  $('#camera-motion').addEventListener('change', (e) => { state.cinematic = e.target.checked; applyExplosion(); });
  $('#inspector-close').addEventListener('click', closeInspector);
  $('#reload-button').addEventListener('click', () => location.reload());
  $('#explore-button').addEventListener('click', () => navigate(chapter === 2 ? 0 : chapter + 1));
  document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', (e) => { e.preventDefault(); navigate(Number(link.dataset.section)); }));
  $('.brand').addEventListener('click', (e) => { e.preventDefault(); navigate(0); });
}

function navigate(index) {
  closeInspector(); stopPlayback(); scrollIntent = true; state.manualView = false;
  const p = [0, .50, 1][index];
  window.scrollTo({ top: p * revealDistance(), behavior: reducedMotion ? 'instant' : 'smooth' });
  // Navigation also works when scroll is already at the requested location.
  gsap.killTweensOf(state);
  gsap.to(state, { sequence: p, duration: reducedMotion ? 0 : 1.8, ease: 'power2.inOut', onUpdate: applyExplosion });
}

try {
  setupScene(); setupInteraction();
  loadWatch().catch(error => {
    console.error('Watch model failed to load:', error); $('#loading').hidden = true; $('#error-state').hidden = false;
  });
} catch (error) {
  console.error('3D renderer initialization failed:', error); $('#loading').hidden = true; $('#error-state').hidden = false;
}

window.addEventListener('pagehide', () => {
  disposed = true; cancelAnimationFrame(animationFrame); scrollTrigger?.kill(); controls?.dispose();
  gsap.killTweensOf(state); stopPlayback(); cameraTween?.kill();
  scene?.traverse(o => { if (o.isMesh) { o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => m.dispose()); } });
  treatments.dispose();
  scene?.background?.dispose();
  scene?.environment?.dispose(); composer?.passes.forEach(pass => pass.dispose?.()); composer?.dispose(); renderer?.dispose();
});
