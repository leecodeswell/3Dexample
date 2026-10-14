# Replacement watch model

The uploaded **Watch – Luxury Wristwatch 3D Model** was inspected through its GLB JSON, nested transforms, mesh bounds, embedded images, Blender import, and Three.js rendering. It replaces the old model entirely.

- Source: `public/watch__luxury_wristwatch_3d_model.glb` (5,987,516 bytes).
- 109 nodes, 56 meshes / material primitives, 8 materials, and 4 embedded PNG textures.
- 49,567 triangles; no authored animations or skeleton.
- SHA-256: `9b99e7fd52a354d5718266b05c0a058e88419c4724d560ee539ca50c6056b34c`.
- Authored hierarchy: `Sketchfab_model → WatchSECKO.fbx → RootNode → named transform nodes → material meshes`.

The full inventory is in `model-inventory.json`. `src/model-config.json` is the shared authoritative mapping used by the application and inspection scripts. Every source mesh appears exactly once across 12 logical components. The runtime validates complete coverage and duplicate assignments before showing the model.

| Component | Source node indices | Treatment |
| --- | --- | --- |
| Case / bezel / frame | 10, 37, 41, 51, 83, 87 | Keep textured case regions and inserts together. |
| Glass | 45 | First forward separation; optional clear physical-glass finish. |
| Dial and subdials | 4, 6, 8, 12, 13, 15, 23, 25, 27, 29, 31, 33, 53, 55, 57, 59, 61, 63, 65, 67, 69, 70, 72, 76, 78, 80, 81, 103, 108 | Keep inscriptions, indices, subdial hands, and face regions together. |
| Hour hand | 21, 91 | Short hand plus its metal region. |
| Minute hand | 17, 89 | Long hand plus its metal region. |
| Seconds hand | 85 | Thin vertical hand. |
| Central hub | 19 | Independent forward lift. |
| Crown | 35 | Radial withdrawal along X. |
| Lug assembly | 74, 95 | Joined lug regions move together. |
| Bracelet | 47, 49, 93 | Multiple material regions of the joined bracelet stay together. |
| Clasp | 43, 97, 98, 100, 101, 105, 106 | Clasp plate, inserts, and details move together. |
| Caseback | 39 | Separate backward reveal. |

Classification follows geometry, world bounds, texture/material regions, and rendered inspection. Source names are generic and do not establish hand functions. The replacement's front face lies in XY; explosion follows Z. A uniform display scale and centering transform normalize the model without changing vertices, UVs, or normals. Reparenting retains each mesh's assembled world matrix, and tests verify exact reassembly within floating-point tolerance.

## Chestnut brown and cinematic materials

The uploaded GLB is stored byte-for-byte. Its green **appearance** changes at runtime, and source textures remain available through the display settings.

- **Patina brunnea:** a selective shader maps green-dominant pixels toward chestnut brown, preserving their luminance, speckle pattern, UVs, engraved markings, and neutral/white areas. This applies to the `Green` texture and green hues in the dial images.
- **Materia cinematica:** physical metal treatments add controlled reflectivity, satin roughness, and subtle clearcoat. A generated normal map adds fine brushing to plain metal surfaces. Embedded image maps remain attached to their original material regions.
- **Studio vitrum:** physical transmission, low roughness, and a restrained clearcoat improve the glass reflections. The source glass has alpha approximately 0.0168 and roughness approximately 0.821.
- Studio softboxes, champagne rim lighting, restrained bloom, a soft vignette, fine grain, and warm color grading complete the treatment.

The three appearance options can be disabled independently in **STUDIUM**. The upload is not baked or re-exported; these are reversible presentation changes.

There is no independently modeled internal gear train. Subdial imagery is part of the texture, and the joined bracelet does not provide per-link pivots. The animation does not infer mechanical parts from pixels.

## Blender authoring

No Blender modifications are needed by the website. The updated optional script organizes the 56 source mesh objects into component collections, retains authored parents and materials, and writes a distinct `.blend` file:

```sh
blender -b --factory-startup --python-exit-code 1 \
  --python tools/prepare_blender.py -- \
  --output /workspace/scratch/luxury-watch-prepared.blend
```

Verified with Blender 4.3.2: 56 objects and 49,567 polygons. Output is outside the checkout; the script refuses to overwrite an existing output.

## Attribution

**Watch – Luxury Wristwatch 3D Model** by **DevPoly3D** is licensed under **CC BY 4.0**, as recorded in the uploaded GLB metadata.

- Author: https://sketchfab.com/DevPoly3D
- Source: https://sketchfab.com/3d-models/watch-luxury-wristwatch-3d-model-693e3e5fc41b42c5af35bc965ab70014
- License: https://creativecommons.org/licenses/by/4.0/
- Presentation modifications: runtime brown recoloring, material finish changes, component grouping/animation, and cinematic lighting/postprocessing. Source geometry and embedded images are retained.

Attribution is also available in the website's display-settings panel. Original modeled/photographed inscriptions remain in the asset; AETERNUM is website placeholder branding.
