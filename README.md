# AETERNUM — interactive watch showcase

A full-screen, responsive Three.js product study using the uploaded luxury wristwatch GLB. Latin placeholder copy, ivory typography, dark olive studio lighting, photographic reflections, and restrained bloom.

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

- **Scroll:** three chapters progressively separate glass, hands, hub, dial, case, crown, lugs, bracelet, clasp, and caseback. Scrolling upward reverses the sequence.
- **Slider:** directly choose any separation amount independently of the page position. The next scroll gesture resumes scroll control.
- **Play:** cinematic nine-second reveal; pause at any point. At full separation, play returns to the assembled watch.
- **Drag:** orbit freely. Right-drag or Ctrl-wheel zooms; normal wheel scrolling advances the page. On touch devices, horizontal drags rotate, vertical gestures scroll, and two-finger gestures provide camera control where supported.
- **Select a part:** click a mesh or visible technical label, then **CONTEMPLARE** to focus the camera on it.
- **Reset icon:** restore the chapter's camera. The neighboring icon toggles slow rotation.
- **STUDIUM:** toggle chestnut-brown recoloring, cinematic material finishes, studio glass, technical labels, and cinematic camera movement.

User rotation is retained until the user resets the camera or resumes the explosion. Reduced-motion preferences disable automatic camera movement and text transitions. Keyboard controls have visible focus outlines; the explosion slider supports arrow keys, Home, and End. Escape closes panels.

## The actual model

The replacement has 109 nodes, 56 meshes, four embedded textures, and 12 logical component groups. The old GLB has been removed. The uploaded file is preserved byte-for-byte in `public/watch__luxury_wristwatch_3d_model.glb`.

Green accents now appear chestnut brown through a reversible shader that preserves texture detail. Physical metal finishes add fine brushing and reflections; glass gets a clearer transmission treatment. Warm grading, fine grain, a vignette, and subtle bloom complete the cinematic appearance. Disable the appearance options in STUDIUM to inspect the source textures/materials.

See [the replacement model inventory and attribution](docs/MODEL.md), [the machine-readable inventory](docs/model-inventory.json), and [the optional Blender preparation script](tools/prepare_blender.py). Model by **DevPoly3D**, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), with credits in the display-settings panel. No independent gear train is present in the asset.

## Validation

```sh
python3 tools/inspect_model.py
npm test
```

Browser tests use the system Chromium when available. Otherwise run `npx playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to your Chromium executable. They verify the original assembled mesh transforms, meaningful staged separation, exact reassembly, scroll takeover after manual input, orbit interaction, settings, and mobile controls. The initial shaders compile once; software-rendered tests can take around a minute.

The optional Blender preparation was also executed successfully with Blender 4.3.2. Its output lives outside the checkout.

## Main files

- `src/main.js`: loader, original-node mapping, component transforms, GSAP scroll/slider control, camera, lighting, picking, and labels.
- `src/materials.js`: selective brown recoloring and physical material variants.
- `src/model-config.json`: inspected component mapping, source path, and normalization.
- `src/style.css`: responsive editorial layout and local font definitions.
- `vite.config.js`: production bundle splitting; Vite serves the uploaded GLB from public/.
- `tools/inspect_model.py`: dependency-free GLB inspection.
- `tests/showcase.spec.js`: browser integration checks.
