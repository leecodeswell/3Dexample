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

The production site is generated in `dist/`. Deploy that directory to any static host. No API keys, backend, HDR downloads, external fonts, or runtime CDN dependencies are required. The model is included byte-for-byte in the production build. Font licenses are in `public/fonts/`; the bundled variable fonts are subset to Latin characters for a smaller download.

## Explore

- **Scroll:** three chapters turn the whole watch through front, side, rear and three-quarter views while separating glass, hands, movement, bridges, 16 gear meshes, tourbillon, case and bracelet. Scrolling upward reverses both rotation and separation.
- **Slider:** directly choose any separation amount independently of the page position. The next scroll gesture resumes scroll control.
- **Play:** cinematic nine-second reveal; pause at any point. At full separation, play returns to the assembled watch.
- **Drag:** orbit freely. Right-drag or Ctrl-wheel zooms; normal wheel scrolling advances the page. On touch devices, horizontal drags rotate, vertical gestures scroll, and two-finger gestures provide camera control where supported.
- **Select a part:** click a mesh or visible technical label, then **CONTEMPLARE** to focus the camera on it.
- **Reset icon:** restore the chapter's camera. The neighboring icon toggles slow rotation.
- **STUDIUM:** toggle chestnut-brown recoloring, cinematic material finishes, studio glass, technical labels, and cinematic camera movement.

User rotation is retained until the user resets the camera or resumes the explosion. Reduced-motion preferences disable automatic camera movement and text transitions. Keyboard controls have visible focus outlines; the explosion slider supports arrow keys, Home, and End. Escape closes panels.

## The actual model

The hybrid uses **27 exterior meshes** from `watch__luxury_wristwatch_3d_model.glb` and **74 mechanical meshes** from `arnoldson_watch_mechanical.glb`. The 101 selected meshes form 30 component groups, including 16 separately controlled gear meshes and a tourbillon. The old flat chronograph face is excluded to expose the actual mechanism.

Both source files are retained unchanged in `public/`. Brown accents, satin steel, warm gold and ruby-like bearings combine the two designs. Source materials remain selectable through STUDIUM. The composition is a designed hybrid visualization, with illustrative gear motion rather than validated engineering ratios.

See [the hybrid model inspection and attribution](docs/MODEL.md), [the complete inventories](docs/model-inventory.json), and [the tested Blender assembly helper](tools/prepare_blender.py). Exterior by **DevPoly3D**, mechanism by **abdelghani.0**; both [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Credits appear in the display-settings panel.

## Validation

```sh
python3 tools/inspect_model.py
npm test
```

Browser tests use the system Chromium when available. Otherwise run `npx playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to your Chromium executable. They verify the original assembled mesh transforms, meaningful staged separation, exact reassembly, scroll takeover after manual input, orbit interaction, settings, and mobile controls. The initial shaders compile once; software-rendered tests can take a few minutes for the dense mechanical model.

The optional Blender preparation was also executed successfully with Blender 4.3.2. Its output lives outside the checkout.

## Main files

- `src/main.js`: two-source loader, component grouping, GSAP progress, gear pivots, camera, lighting, picking, and labels.
- `src/choreography.js`: reversible model rotation and camera poses across the scroll sequence.
- `src/materials.js`: selective brown recoloring and physical material variants.
- `src/model-config.json`: inspected component mapping, both source paths, mesh selection, gear pivots, and normalization.
- `src/style.css`: responsive editorial layout and local font definitions.
- `vite.config.js`: production bundle splitting; Vite serves the uploaded GLB from public/.
- `tools/inspect_model.py`: dependency-free GLB inspection.
- `tests/showcase.spec.js`: browser integration checks.
