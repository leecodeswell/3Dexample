# AETERNUM — interactive watch showcase

A full-viewport Three.js watch advertisement with a chestnut open-heart dial, a real mechanical interior, reversible scroll-driven separation and cinematic rotation. Latin placeholder copy, local fonts and floating inspection controls.

## Run

Node.js 20.19+ or 22.12+ is required; this environment uses Node 24.

```sh
npm ci
npm run dev
npm run build
npm run preview
```

Deploy `dist/` to a static host. Runtime needs no backend, credentials, external fonts, third-party HDR service or Blender installation. **Only `public/watch-photoreal.glb` remains**; the two obsolete source models were removed from the checkout and production build. Their attribution remains in the site and documentation.

## Explore

- Scroll to separate the crystal, hands, dial, movement, bridges, gears, case and bracelet while the camera and model turn. Continue scrolling after the reveal for a cinematic 360° orbit with every part held fully expanded. Scroll upward to reverse the orbit, then reassemble. Playback adds a 7.5-second orbit after the existing nine-second reveal, with a shorter 0.6-second lead-in. One gentle pullback frames the whole assembly before the turn; the camera then holds its distance and height.
- Use the slider for direct control, or Play for the nine-second reversible reveal.
- Drag to orbit; right-drag or Ctrl-wheel to zoom. Normal wheel scrolling advances the page.
- Select a part or technical label and choose **CONTEMPLARE** for a closer camera view.
- Reset restores the chapter camera; the adjacent control toggles slow rotation.
- **STUDIUM** controls brown recoloring, studio finishes, glass, labels and cinematic camera motion.

Reduced-motion preferences disable automatic camera motion. The slider supports keyboard navigation. Escape closes panels. Portrait and short landscape layouts retain their controls.

## Model and photographic treatment

The single active GLB contains **110 meshes in 31 groups**, with 16 independently animated gear meshes. The solid brown face has 60 applied indices, Roman numerals, sword hands and a physical open-heart aperture. The outer bezel is clean dark enamel without city lettering. Mechanical parts stay below the dial and hands stay above it throughout the reveal. The closed sapphire crystal has a shallow polished dome and clears every hand. As it separates it tilts and moves aside, with restrained reflections that keep the dial visible.

Shared [finish profiles](src/finish-profiles.json) distinguish polished case steel, brushed bracelet steel, machined gold, polished applied markers, ceramic accents, ivory inlays and sapphire. Eight local normal/roughness maps include a radial sunburst dial. A generated HDR studio uses feathered softboxes; rectangular area illumination, soft shadows and GTAO contact shading make the bridges and gears read with depth. Refraction uses full-opacity transmission with restrained coating reflections, rather than fading away the crystal. Four additional rectangular sources choreograph warm strip reflections, a cool lateral sweep, a traveling overhead highlight and an amber backlight through the reveal and final orbit. Pointer movement gently steers the reflection rig; reversing the sequence reverses the lighting. High-energy amber and ice-blue strips drive pronounced bloom. The 16 gears retain distinct brass and steel finishes, with surface reflections from the moving lights rather than sprite glares. Machined plates preserve darker steel contrast, and the sapphire carries stronger neutral Fresnel reflections. Lighting reverses with the sequence and holds steady for reduced motion. Brushed, machined, polished and sunburst maps carry higher-contrast roughness and deeper micro-normal relief, with layered clearcoat on the studio finishes. Reduced-motion mode holds the rig steady, and the cinematic-finish control disables the added lighting. Film grain remains restrained.

Desktop hardware receives the complete studio pass. Mobile and software GPUs use the same materials and HDR lighting with cheaper shading. For a full-quality diagnostic preview, use `/?quality=studio`. This also lets browser tests exercise contact shading and shadow rendering on software GPUs. The renderer stays idle when the scene does not change.

The loading poster is a denoised Cycles render of the **actual active model**, not an imagined/generated watch. There is no external generation API dependency.

See [model inspection and attribution](docs/MODEL.md), [the active inventory](docs/model-inventory.json), and [measured face depths](docs/face-depths.json).

## Validation

```sh
python3 tools/inspect_model.py
npm test
```

Tests cover visible rendered pixels, a single model request, crystal/hand clearance, gear/dial/hand ordering during reveal and reversal, exact reassembly, scroll ownership, orbit, settings, focus, portrait/landscape controls, and the full-quality contact/shadow pipeline. Tests use system Chromium; set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` if needed. Software rendering can take a few minutes.

## Optional authoring

The asset is already committed; these steps are not startup dependencies. Blender 4.3+ imports the active GLB directly. Python surface/environment generation uses NumPy and Pillow.

```sh
python3 tools/generate_surface_maps.py
python3 tools/generate_studio.py
blender -b --factory-startup --python-exit-code 1 --python tools/prepare_blender.py -- --output /tmp/watch-studio.blend
blender -b --factory-startup --python-exit-code 1 --python tools/render_hero.py
```

For a cleaner product render, pass `-- --denoiser /path/to/oidnDenoise` to `render_hero.py`, using Intel's official [Open Image Denoise](https://www.openimagedenoise.org/). It is optional and not shipped with the app. The helper preserves the alpha silhouette and uses linear HDR beauty, albedo and normal guides. It writes a 1920-pixel PNG; convert that output to WebP for the loading poster. `--samples`, `--width` and `--output` configure the render.

`tools/refine_crystal.py` can reproduce the shallow sapphire geometry from the active model into a separate GLB. It verifies the other 109 meshes retain their world bounds and writes updated depth measurements beside its output. It refuses to overwrite either its input or an existing output. The old source-dependent refinement pipeline was removed.

`tools/refine_bezel.py` documents the removal of the original city-letter texture from the front bezel, preserving the entire binary chunk and adding a centered crystal pivot. That refinement is already included in the active asset. All groups now begin separating within the first 13% of the sequence, without shortening the scroll track or nine-second playback.

Exterior by **DevPoly3D**, mechanism by **abdelghani.0**; both [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Local font licenses remain in `public/fonts/`. Gear motion is an illustrative hybrid rather than validated engineering ratios.
