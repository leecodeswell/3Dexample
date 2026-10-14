# AETERNUM — interactive watch showcase

A full-screen, responsive Three.js product study combining a luxury exterior with an actual mechanical gear-and-tourbillon model. The oversized watch fills the page behind the editorial layout. Latin placeholder copy, ivory typography, dark olive studio lighting, photographic reflections, and restrained bloom.

## Run

Node.js 20.19+ or 22.12+ is required by Vite; this environment uses Node 24.

```sh
npm ci
npm run dev
```

```sh
npm run build
npm run preview
```

The production site is generated in `dist/`. Deploy that directory to any static host. No API keys, backend, HDR downloads, external fonts, or runtime CDN dependencies are required. The refined model and both intact uploads are bundled in the production build. Font licenses are in `public/fonts/`; the bundled variable fonts are subset to Latin characters for a smaller download.

## Explore

- **Scroll:** three chapters turn the whole watch through front, side, rear and three-quarter views while separating glass, hands, dial, movement, bridges, 16 gear meshes, tourbillon, case and bracelet. Scrolling upward reverses both rotation and separation.
- **Slider:** directly choose any separation amount independently of the page position. The next scroll gesture resumes scroll control.
- **Play:** cinematic nine-second reveal; pause at any point. At full separation, play returns to the assembled watch.
- **Drag:** orbit freely. Right-drag or Ctrl-wheel zooms; normal wheel scrolling advances the page. On touch devices, horizontal drags rotate, vertical gestures scroll, and two-finger gestures provide camera control where supported.
- **Select a part:** click a mesh or visible technical label, then **CONTEMPLARE** to focus the camera on it.
- **Reset icon:** restore the chapter's camera. The neighboring icon toggles slow rotation.
- **STUDIUM:** toggle chestnut-brown recoloring, cinematic material finishes, studio glass, technical labels, and cinematic camera movement.

User rotation is retained until the user resets the camera or resumes the explosion. Reduced-motion preferences disable automatic camera movement and text transitions. Keyboard controls have visible focus outlines; the explosion slider supports arrow keys, Home, and End. Escape closes panels.

## The actual model

The refined display uses **21 exterior meshes**, **74 mechanical meshes** and **15 newly modeled face/hand meshes**: 110 meshes in 31 component groups, including 16 independently controlled gear meshes. A solid chestnut dial has a real open-heart aperture, applied hour markers, a minute track and Roman numerals. The movement is recessed beneath the dial; the three hands and their ivory inlays sit above all face decoration. Scrolling lifts the dial to reveal the full mechanism.

Both uploads remain unchanged in `public/`. The separate `watch-photoreal.glb` derivative adds tiny bevels and refined normals. Six deterministic normal/roughness maps distinguish satin steel, machined gold and polished surfaces. The assembly and gear motion remain an illustrative hybrid rather than an engineering reconstruction.

See [inspection and attribution](docs/MODEL.md), [complete inventories](docs/model-inventory.json), [measured face depths](docs/face-depths.json), and [Blender refinement](tools/refine_geometry.py). Exterior by **DevPoly3D**, mechanism by **abdelghani.0**; both [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Credits appear in settings.

## Validation

```sh
python3 tools/inspect_model.py
npm test
```

Browser tests use the system Chromium when available. Otherwise run `npx playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to your Chromium executable. They verify the actual gear/dial/hand depth order, derivative transforms, meaningful staged separation, exact reassembly, scroll takeover after manual input, orbit interaction, settings, and mobile controls. The initial shaders compile once; software-rendered tests can take a few minutes for the dense mechanical model.

The optional Blender preparation was also executed successfully with Blender 4.3.2. Its output lives outside the checkout.

## Main files

- `src/main.js`: refined GLB loader, component grouping, GSAP progress, gear pivots, camera, lighting, picking, and labels.
- `src/choreography.js`: reversible model rotation and camera poses across the scroll sequence.
- `src/materials.js`: selective brown recoloring and physical material variants.
- `src/model-config.json`: inspected component mapping, both source paths, mesh selection, gear pivots, and normalization.
- `src/style.css`: responsive editorial layout and local font definitions.
- `vite.config.js`: production bundle splitting; Vite serves the uploaded GLB from public/.
- `tools/inspect_model.py`: dependency-free GLB inspection.
- `tests/showcase.spec.js`: browser integration checks.

## Optional asset authoring

Runtime needs no Blender or Python packages. Authoring uses Blender 4.3+, NumPy and Pillow:

```sh
python3 tools/generate_surface_maps.py
blender -b --factory-startup --python-exit-code 1 --python tools/prepare_blender.py -- --output /workspace/scratch/hybrid-watch-preserved.blend
blender -b /workspace/scratch/hybrid-watch-preserved.blend --python-exit-code 1 --python tools/refine_geometry.py
blender -b /workspace/scratch/watch-photoreal.blend --python-exit-code 1 --python tools/render_hero.py
```

Preparation refuses to overwrite an existing `.blend`. Refinement exports a separate derivative and measured depths; uploads are never overwritten. The render helper ray-traces the actual model. Its checked-in WebP serves as the loading poster. Higgsfield was unavailable in this environment; no Higgsfield API or generated content is used.
