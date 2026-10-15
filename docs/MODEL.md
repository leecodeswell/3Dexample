# Refined mechanical watch

`public/watch-photoreal.glb` is the single canonical model. The two legacy uploads were removed at the user's request. The active model includes their selected exterior and mechanical parts, the designed dial/hands, and a refined closed sapphire crystal. Historical source assets can be recovered from Git history if ever needed; runtime and authoring require only the active GLB.

## Inspected geometry

**110 mesh primitives**, **31 component groups**, **590,615 triangles**: 21 exterior meshes, 74 mechanical meshes and 15 designed face/hand meshes. Component metadata (`watch_component`, `watch_source`, `watch_pivot`) is embedded in the GLB. `src/model-config.json` declares the one asset, expected coverage and the local HDR environment.

The case, crown, bracelet, clasp, backplate, bridges, movement and 16 gear meshes retain their authored shape. Small bevels and weighted normals provide edge reflections. The movement sits beneath a solid chestnut dial with 60 indices, Roman numerals and a genuine six-o'clock open-heart opening. Three separate sword/needle hands sit above the face. Some wheel meshes contain compound geometry; 16 meshes do not imply 16 individual manufactured wheels.

The city abbreviations belonged to the embedded image on `photo_exterior_case_029`, the annular front bezel, and its thin outer lip (`photo_exterior_case_017`). They now use unlettered polished dark enamel and steel materials. `tools/refine_bezel.py` changes those two material assignments and supplies a crystal-center pivot; the complete GLB binary chunk remains byte-for-byte unchanged. The source atlas remains embedded for other original surfaces and attribution, but is no longer applied to either bezel surface.

The original coarse, steep dome was replaced with a closed, shallow sapphire crystal: 128 circumferential segments, 20 radial rings, 0.016 normalized units of thickness and 0.022 of dome sag. Its back surface begins at z=0.129, above the highest hand/cap surface at z=0.116. Its front reaches z=0.167. Refraction consequently requires no fake alpha fade. `tools/refine_crystal.py` verifies unchanged world bounds for the other 109 meshes before exporting.

`docs/face-depths.json` records measured geometry depths. Browser tests independently verify crystal clearance and gear/dial/hand order at multiple reveal/reversal points. Full affine matrices and saved origins preserve exact reassembly. The dial lifts before the mechanism, preventing bridges or gears from passing through its face.

```sh
python3 tools/inspect_model.py --output docs/model-inventory.json
```

The inventory contains the active hierarchy, primitives, materials, embedded images, source/component metadata and checksum. Original source-dependent mappings and broken asset paths have been removed.

## Lighting and surfaces

`src/finish-profiles.json` supplies common material parameters to Three.js and Blender. Case steel has a polished finish; bracelet and movement steel are brushed; gears use machined gold; indices and hands use polished champagne metal. The brown dial has radial satin grain. Neutral midtones in the old steel atlas are calibrated to metal reflectance rather than multiplying its baked gray shading into an unrealistically dark metal. Engraved blacks, light inscriptions and colored inserts remain protected. This treatment is reversible with the finish setting; embedded image pixels are unchanged. Sapphire uses IOR 1.76, full transmission and low coating reflectance, with the crystal treated as one closed volume rather than two alpha-blended surfaces. Refraction uses the actual optical roughness independently of Three.js's minimum specular roughness, preserving fine lettering beneath the lens. The key softbox sits outside the dial's mirror reflection; a dimmer reflection card lights its metal without washing out the glass.

Eight deterministic normal/roughness maps come from `tools/generate_surface_maps.py`. `tools/generate_studio.py` creates a local linear RGBE panorama with feathered photographic softboxes, ceiling bounce and a dark floor. It is an analytic lighting rig, not a downloaded HDR photograph. HDR reflections, rectangular area lighting, soft shadows, GTAO contact shading, restrained bloom, warm grading and fine grain complete the image.

Glass is excluded from the contact shading depth/normal pass so its dome cannot hide the dial. AO runs at half resolution, with conservative radius and strength. Mobile/software GPUs retain the material and reflection treatment while skipping the expensive shadow/AO passes. `/?quality=studio` forces that path for diagnosis and verification. Pixel ratio is capped at 1.5; rendering rests when the view is static. A pre-bloom guard prevents invalid imported UV shading from propagating across the full frame.

## Animation and authoring

The full-viewport canvas remains the page's backdrop. `src/choreography.js` supplies five eased front and three-quarter poses. Scroll, slider and playback share a reversible progress state; manual orbit and part focus remain available. Reduced-motion preferences disable automatic camera turns. The camera stays on the front side throughout separation so the emerging mechanism stays visible; manual orbit still permits rear inspection. All model turns reverse deterministically. After the original reveal finishes, an additional short scroll section holds the complete exploded arrangement while the camera makes one full 360-degree orbit. The camera makes one gentle pullback before turning, then holds a constant distance, height and target for the full revolution. The expanded model’s measured world bounds determine a single distance that fits every azimuth, including portrait screens. The final view holds that wider framing; reverse scrolling retraces the turn and the initial pullback. Scrolling back retraces the orbit before any part reassembles. Playback retains the nine-second reveal and adds a nine-second orbit; reverse playback unwinds that orbit first. The explosion slider continues to control separation only, and reduced-motion defaults keep automatic camera movement disabled.

Every component starts separating within the first 13% of progress. Hands and dial lead the movement, while the case, bracelet and mechanical layers begin moving soon afterward. The dial drifts upward and aside as it lifts, leaving the mechanical stack visible rather than covering the emerging gears. Components continue traveling through the original full scroll track and nine-second playback; camera turns and gear rotation keep their full duration. The crystal lifts above the hands, tilts about its own center, and drifts aside. Its environment reflection intensity is restrained, while full-opacity transmission and the assembled geometry remain intact. A screen-space studio backdrop is rendered into the transmission buffer: this replaces Three.js’s white fallback for transparent canvases, which previously made detached glass look opaque. Reverse playback restores its exact orientation and position.

`tools/prepare_blender.py` imports the one active GLB and organizes 31 component collections into a new `.blend`. No legacy asset is needed. `tools/render_hero.py` imports the same GLB directly, applies shared surface profiles and HDR lighting, and ray-traces the actual assembly with Cycles. The crystal does not block shadow rays, matching Three.js's no-shadow crystal treatment and avoiding dark glass-caustic artifacts over the face; camera rays retain full physical refraction. Optional Open Image Denoise uses HDR beauty plus albedo/normal guides while retaining the original alpha silhouette. The denoised render becomes the checked-in WebP loading poster; Blender and the denoiser are not runtime dependencies.

The hybrid remains a designed visualization. Validated gear ratios, functional escapement simulation, manufacturing tolerances and CAD reconstruction require engineering references and manual work. Independently animating every wheel within a compound mesh requires manual separation.

## Attribution

Both source designs are licensed under **CC BY 4.0**. The active GLB embeds their attribution and modification notice. Attribution appears in the website's STUDIUM panel.

**Watch – Luxury Wristwatch 3D Model**, by **DevPoly3D**:

- https://sketchfab.com/DevPoly3D
- https://sketchfab.com/3d-models/watch-luxury-wristwatch-3d-model-693e3e5fc41b42c5af35bc965ab70014

**arnold&son watch mechanical**, by **abdelghani.0**:

- https://sketchfab.com/abdelghani.0
- https://sketchfab.com/3d-models/arnoldson-watch-mechanical-4dc8d4dd90cb4b4e9752bcf988f357cf

License: https://creativecommons.org/licenses/by/4.0/

Presentation modifications: mesh selection and combination, uniform display normalization, reversible grouping and animation, replacement dial/hands and shallow closed sapphire crystal, unlettered enamel bezel, recessed and rotated movement, micro bevels and weighted normals, brown recoloring, studio material treatments and cinematic lighting/postprocessing. Other source inscriptions and embedded image maps remain in the combined model. AETERNUM remains Latin placeholder website branding.
