import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
gsap.ticker.lagSmoothing(0);
const $ = (s) => document.querySelector(s);
const canvas = $('#watch-canvas'), stage = $('#stage');
const slider = $('#explosion-slider'), output = $('#explosion-value');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = () => innerWidth <= 700;
const state = { progress: 0, ready: false, cinematic: !reducedMotion, labels: true, studio: true, interacting: false, focused: false, manualView: false };
const parts = new Map(), pickable = [], originals = new Map(), labels = [];
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const chapters = [
  { eyebrow: 'TEMPUS, IN FORMA', title: 'Ars longa.<br><em>Tempus breve.</em>', description: 'In singulis partibus, universum.<br>Forma, materia et motus in perfecta concordia.', name: 'FORMA PERFECTA', action: 'EXPLORA OPUS' },
  { eyebrow: 'ANATOMIA TEMPORIS', title: 'Singula.<br><em>Mirabilia.</em>', description: 'Quod oculus non videt, ars revelat.<br>Unum opus. Multae formae. Una essentia.', name: 'ORDO ET MATERIA', action: 'REVELA PARTES' },
  { eyebrow: 'ESSENTIA REVELATA', title: 'Omnia.<br><em>In uno.</em>', description: 'Vitrum, argentum, lumen.<br>Perfectio ex singulis partibus nascitur.', name: 'ESSENTIA REVELATA', action: 'REDI AD INITIUM' },
];
let chapter = -1, renderer, composer, camera, controls, scene, bloom, explosionTween, cameraTween;
let animationFrame, scrollTrigger, lastInteraction = 0, clickStart, disposed = false;
let scrollIntent = true;
const cinematicTarget = new THREE.Vector3();
const cinematicPosition = new THREE.Vector3();
const glass = [];

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
  $('#scroll-progress-fill').style.width = `${p * 100}%`;
  setChapter(p < .30 ? 0 : p < .74 ? 1 : 2);
}

function smoothStep(start, end, p) {
  const x = THREE.MathUtils.clamp((p - start) / (end - start), 0, 1);
  return x * x * (3 - 2 * x);
}

const definitions = {
  case: { title: 'Corpus', subtitle: 'I / CORPUS', description: 'Argentum in forma. Corpus et lunula, in perfecta concordia.', offset: [0, -.42, 0], range: [.25, .72], anchor: [0, 0, -1.15] },
  dial: { title: 'Tabula', subtitle: 'IV / TABULA', description: 'Caeruleum profundum. Numeri et indices una cum tabula moventur.', offset: [0, 1.0, 0], range: [.36, .83], anchor: [0, 0, -.95] },
  glass: { title: 'Vitrum', subtitle: 'II / VITRUM', description: 'Lumen transit. Vitrum a corpore leniter separatur.', offset: [0, 3.05, 0], range: [.02, .51], anchor: [0, 0, -.95] },
  hour: { title: 'Hora', subtitle: 'III / HORA', description: 'Parva sagitta, horae indicium. Motus in proprio axe.', offset: [-.12, 1.8, .05], range: [.23, .63], anchor: [-.45, 0, -.1] },
  minute: { title: 'Minuta', subtitle: 'III / MINUTA', description: 'Longa sagitta, subtilis mensura. Pars singularis et libera.', offset: [.12, 2.2, -.03], range: [.18, .64], anchor: [0, 0, -.55] },
  second: { title: 'Secunda', subtitle: 'III / SECUNDA', description: 'Momentum fugit. Tertia sagitta separatim revelatur.', offset: [0, 2.6, .09], range: [.12, .58], anchor: [0, 0, -.35] },
  hub: { title: 'Axis', subtitle: 'III / AXIS', description: 'In centro, concordia. Axis sagittas in unum colligit.', offset: [0, 1.5, 0], range: [.22, .66], anchor: [0, 0, 0] },
  crown: { title: 'Corona', subtitle: 'V / CORONA', description: 'Corona ad latus. Parva forma, magna diligentia.', offset: [0, .06, -.9], range: [.55, .94], anchor: [0, 0, -.1] },
  bars: { title: 'Vincula', subtitle: 'V / VINCULA', description: 'Vincula corpus et armillam coniungunt. Unus reticulus, duo axes.', offset: [.55, -.15, 0], range: [.56, .94], anchor: [1.05, 0, 0] },
  bracelet: { title: 'Armilla', subtitle: 'VI / ARMILLA', description: 'Metallum circa carpi formam. Articuli in uno reticulo coniuncti.', offset: [0, -.86, 0], range: [.46, .95], anchor: [0, -1.3, -.65] },
  clasp: { title: 'Fibula', subtitle: 'VI / FIBULA', description: 'Ultima pars, perfecta clausura. Fibula et parvus cardo simul moventur.', offset: [0, -1.35, 0], range: [.61, 1], anchor: [0, -3.2, -.3] },
};

function applyExplosion() {
  for (const part of parts.values()) {
    const t = smoothStep(...part.range, state.progress);
    part.group.position.copy(part.origin).addScaledVector(part.offset, t);
  }
  displayProgress(state.progress);
  // Values are interpolated rather than accumulated: reversing returns every transform exactly.
  const p = smoothStep(0, 1, state.progress);
  if (mobile()) {
    cinematicPosition.set(3.4 + p * 2.2, -3.1 + p * .7, 8.1 + p * 1.4);
    cinematicTarget.set(0, -.2, -.75 + p * 1.0);
  } else {
    cinematicPosition.set(3.0 + p * 5.6, -2.6 + p * 5, 6.8 + p * .4);
    cinematicTarget.set(0, 0, -.72 + p * 1.4);
  }
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
  const radius = Math.max(box.getSize(new THREE.Vector3()).length() * .75, 1.1);
  const direction = camera.position.clone().sub(controls.target).normalize();
  const destination = center.clone().addScaledVector(direction, radius * 2.3);
  cameraTween?.kill(); state.focused = true;
  cameraTween = gsap.timeline().to(camera.position, { x: destination.x, y: destination.y, z: destination.z, duration: reducedMotion ? 0 : 1.5, ease: 'power3.inOut' }, 0)
    .to(controls.target, { x: center.x, y: center.y, z: center.z, duration: reducedMotion ? 0 : 1.5, ease: 'power3.inOut' }, 0);
}

async function loadWatch() {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync('/mechanical watch.glb', (e) => {
    if (e.total) $('#load-percent').textContent = `${Math.round(e.loaded / e.total * 100)}%`;
  });
  const model = gltf.scene;
  const orientation = new THREE.Group(); orientation.rotation.z = -Math.PI / 2;
  model.rotation.x = Math.PI / 2;
  orientation.add(model); scene.add(orientation);
  // Parser associations identify the actual source nodes, independent of name sanitization.
  const nodes = await Promise.all(gltf.parser.json.nodes.map((_, i) => gltf.parser.getDependency('node', i)));
  const caseNode = nodes[0];
  const dialPrimitive = caseNode.children.find(child => child.isMesh && child.material?.name === 'digit place');
  if (!dialPrimitive) throw new Error('Expected independent dial primitive was not found.');
  scene.updateMatrixWorld(true);
  const sourceWorld = new Map(); model.traverse(o => { if (o.isMesh) sourceWorld.set(o, o.matrixWorld.clone()); });
  const memberships = {
    case: [caseNode, nodes[2]], glass: [nodes[7]], dial: [dialPrimitive, ...nodes.slice(8, 16)],
    hour: [nodes[19]], minute: [nodes[20]], second: [nodes[18]], hub: [nodes[16], nodes[17]],
    crown: [nodes[1]], bars: [nodes[4]], bracelet: [nodes[3]], clasp: [nodes[5], nodes[6]],
  };
  // Detach the dial first so the remaining case node can move separately. attach preserves world transforms.
  for (const key of ['dial', 'case', 'glass', 'hour', 'minute', 'second', 'hub', 'crown', 'bars', 'bracelet', 'clasp']) {
    const group = new THREE.Group(); group.name = `component_${key}`; model.add(group);
    memberships[key].forEach(node => group.attach(node));
    const def = definitions[key];
    const part = { ...def, group, origin: group.position.clone(), offset: new THREE.Vector3(...def.offset), range: def.range };
    parts.set(key, part);
    group.traverse(child => {
      if (!child.isMesh) return;
      child.userData.part = key; pickable.push(child);
      child.castShadow = true; child.receiveShadow = true;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        if (material.name === 'Window Glass') {
          originals.set(child, child.material);
          // Source material is retained. This optional cloned physical treatment fixes the
          // exported BLEND material's alpha=1 without altering the GLB or other materials.
          const studio = new THREE.MeshPhysicalMaterial({
            name: 'Studio vitrum', color: '#e7edf0', metalness: 0, roughness: .075,
            transmission: .96, thickness: .09, ior: 1.46, transparent: true, opacity: .22,
            clearcoat: 1, clearcoatRoughness: .04, side: THREE.DoubleSide, depthWrite: false,
          });
          glass.push({ mesh: child, original: child.material, studio });
          child.material = studio; child.castShadow = false; child.renderOrder = 2;
        }
      }
    });
  }
  // Seven restrained labels; all actual meshes remain available by clicking.
  for (const key of ['glass', 'second', 'dial', 'case', 'crown', 'bracelet', 'clasp']) {
    const el = document.createElement('div'); el.className = 'part-label';
    const button = document.createElement('button'); button.textContent = parts.get(key).subtitle;
    button.setAttribute('aria-label', `Inspect ${key}`); button.tabIndex = -1;
    button.addEventListener('click', () => showPart(key)); el.append(button); $('#labels').append(el);
    labels.push({ key, el, button, point: new THREE.Vector3(...definitions[key].anchor) });
  }
  state.ready = true; slider.disabled = false;
  applyExplosion(); controls.target.copy(cinematicTarget); camera.position.copy(cinematicPosition); controls.update();
  $('#loading').hidden = true;
  gsap.fromTo(canvas, { opacity: 0 }, { opacity: 1, duration: reducedMotion ? 0 : 1.7 });
  window.__watchShowcase = {
    get progress() { return state.progress; },
    get parts() { return [...parts.keys()]; },
    get meshCount() { return pickable.length; },
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
  camera.fov = mobile() ? 37 : 38; camera.updateProjectionMatrix();
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
    if (mobile() && !['glass', 'dial', 'bracelet'].includes(label.key)) show = false;
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
  const dt = Math.min(clock.getDelta(), .05);
  if (state.ready) {
    const canFollow = state.cinematic && !state.manualView && !state.interacting && !state.focused && !controls.autoRotate && performance.now() - lastInteraction > 4500;
    if (canFollow && !cameraTween?.isActive()) {
      const alpha = 1 - Math.exp(-dt * 3.5);
      camera.position.lerp(cinematicPosition, alpha);
      controls.target.lerp(cinematicTarget, alpha);
    }
    controls.update(); scene.updateMatrixWorld(); updateLabels();
  }
  composer.render();
}

function setupScene() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile() ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .9;
  renderer.setClearColor(0x141613, 0);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, 1, .05, 70);
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = .07; controls.enablePan = false;
  controls.minDistance = 3; controls.maxDistance = 19; controls.autoRotateSpeed = .45;
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
  // High-contrast photographic softboxes: reflections stay detailed rather than
  // washing the source silver into a uniform white. No source materials are recolored.
  const envScene = new THREE.Scene(); envScene.background = new THREE.Color('#454a43');
  const boxes = [
    { pos: [-5, 3, 4], size: [4, 9], color: [4.2, 3.8, 3.1] },
    { pos: [5, 1, 2], size: [2, 8], color: [2.5, 3.0, 3.5] },
    { pos: [0, 7, -1], size: [5, 3], color: [3.5, 3.5, 3.2] },
    { pos: [-1, -2, -6], size: [6, 1], color: [3.0, 2.4, 1.7] },
  ];
  const softboxes = boxes.map(b => {
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    material.color.setRGB(...b.color);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...b.size), material);
    mesh.position.set(...b.pos); mesh.lookAt(0, 0, 0); envScene.add(mesh); return mesh;
  });
  const envGenerator = new THREE.PMREMGenerator(renderer);
  const studioEnv = envGenerator.fromScene(envScene, .025);
  scene.environment = studioEnv.texture; scene.environmentIntensity = 1.0;
  envGenerator.dispose(); softboxes.forEach(m => { m.geometry.dispose(); m.material.dispose(); });
  const key = new THREE.DirectionalLight(0xffedce, 1.1); key.position.set(-3, 6, 7); scene.add(key);
  const fill = new THREE.DirectionalLight(0xc7dded, .45); fill.position.set(5, -1, 3); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xf2d1a0, 1.3); rim.position.set(-4, -3, -2); scene.add(rim);
  scene.add(new THREE.AmbientLight(0xd3dcc5, .12));
  composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .045, .4, 1.7); composer.addPass(bloom);
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

function setupInteraction() {
  setChapter(0); $('#camera-motion').checked = state.cinematic;
  scrollTrigger = ScrollTrigger.create({
    trigger: '.scroll-track', start: 'top top', end: 'bottom bottom',
    onUpdate: (self) => {
      if (!state.ready || !scrollIntent) return;
      stopPlayback(); closeInspector(); state.manualView = false;
      gsap.killTweensOf(state);
      gsap.to(state, { progress: self.progress, duration: reducedMotion ? 0 : .55, ease: 'power2.out', onUpdate: applyExplosion });
    },
  });
  // Only deliberate scrolling takes ownership after manual slider input.
  window.addEventListener('wheel', () => { scrollIntent = true; }, { passive: true, capture: true });
  window.addEventListener('scroll', () => { scrollIntent = true; }, { passive: true });
  window.addEventListener('touchmove', (event) => { if (!stage.contains(event.target)) scrollIntent = true; }, { passive: true });
  window.addEventListener('keydown', (e) => {
    if (['PageDown', 'PageUp', 'Home', 'End', 'ArrowDown', 'ArrowUp', ' '].includes(e.key) && !['INPUT', 'BUTTON'].includes(document.activeElement?.tagName)) scrollIntent = true;
    if (e.key === 'Escape') { $('#settings-panel').hidden = true; $('#settings-toggle').setAttribute('aria-expanded', 'false'); closeInspector(); }
  });
  slider.addEventListener('input', () => {
    if (!state.ready) return;
    scrollIntent = false; stopPlayback(); closeInspector(); state.manualView = false; gsap.killTweensOf(state);
    state.progress = Number(slider.value) / 1000; applyExplosion();
  });
  slider.addEventListener('pointerdown', () => { scrollIntent = false; stopPlayback(); });
  $('#play-explosion').addEventListener('click', () => {
    if (!state.ready) return;
    if (explosionTween?.isActive()) { stopPlayback(); return; }
    scrollIntent = false; closeInspector(); state.manualView = false; gsap.killTweensOf(state);
    const destination = state.progress > .99 ? 0 : 1;
    $('#play-explosion').textContent = 'II'; $('#play-explosion').setAttribute('aria-label', 'Pause exploded view');
    explosionTween = gsap.to(state, { progress: destination, duration: reducedMotion ? .4 : Math.max(2, Math.abs(destination - state.progress) * 9), ease: 'sine.inOut', onUpdate: applyExplosion, onComplete: stopPlayback });
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
  $('#studio-glass').addEventListener('change', (e) => { state.studio = e.target.checked; glass.forEach(g => { g.mesh.material = state.studio ? g.studio : g.original; }); });
  $('#show-labels').addEventListener('change', (e) => { state.labels = e.target.checked; });
  $('#camera-motion').addEventListener('change', (e) => { state.cinematic = e.target.checked; });
  $('#inspector-close').addEventListener('click', closeInspector);
  $('#reload-button').addEventListener('click', () => location.reload());
  $('#explore-button').addEventListener('click', () => navigate(chapter === 2 ? 0 : chapter + 1));
  document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', (e) => { e.preventDefault(); navigate(Number(link.dataset.section)); }));
  $('.brand').addEventListener('click', (e) => { e.preventDefault(); navigate(0); });
}

function navigate(index) {
  closeInspector(); stopPlayback(); scrollIntent = true; state.manualView = false;
  const p = [0, .50, 1][index];
  const max = document.documentElement.scrollHeight - innerHeight;
  window.scrollTo({ top: p * max, behavior: reducedMotion ? 'instant' : 'smooth' });
  // Navigation also works when scroll is already at the requested location.
  gsap.killTweensOf(state);
  gsap.to(state, { progress: p, duration: reducedMotion ? 0 : 1.8, ease: 'power2.inOut', onUpdate: applyExplosion });
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
  glass.forEach(g => { g.original.dispose(); g.studio.dispose(); });
  scene?.environment?.dispose(); composer?.dispose(); renderer?.dispose();
});
