# Source model inspection

The file was inspected programmatically through its GLB JSON and buffer headers, imported with Blender 4.3.2, and checked through Three.js in Chromium. The complete machine-readable inventory is in `model-inventory.json`; regenerate it with `python3 tools/inspect_model.py --output docs/model-inventory.json`.

- GLB 2.0; 5,458,100 bytes; embedded resources only.
- One scene with 21 independent root nodes, 21 meshes, 25 material primitives, and seven source materials.
- No authored animations, skeletons, or nested mechanical hierarchy.
- 204,260 triangles. Source SHA-256: `9dd9489860aa2eee7f691b3dd2bcf3a2256e98a2cf2e5f5870309fb99f1b1535`.

| Source node(s) | Identified component | Runtime treatment |
| --- | --- | --- |
| `Cylinder` | Case body and blue dial surface | Two existing material primitives (`body`, `digit place`). Reparent the dial primitive independently; no geometry split or new surfaces. |
| `Cube.004` | Outer case/lug frame | Keep with the case body. |
| `glass` | Glass shell | Independent forward lift, first in the sequence. |
| `Cube.002` | Thin diagonal hand, treated as seconds | Independent forward lift. |
| `Cube` | Short luminous hand, treated as hours | Independent forward lift. |
| `Cube.001` | Long luminous hand, treated as minutes | Independent forward lift. |
| `Cylinder.004`, `Cone` | Central hub and cap | Group into one hub component. |
| `Text` through `Text.005`, `Plane`, `Curve` | Numerals, inscriptions, indices, luminous inlays, emblem | Keep with the blue dial surface. |
| `Cylinder.003` | Side crown | Withdraw radially from the case. |
| `Cylinder.006` | Paired spring bars | One joined mesh; animate together. |
| `Cube.006` | Joined metal bracelet | Move the complete bracelet behind the case. |
| `Cube.005`, `Cube.008` | Clasp plate and small detail | Group and separate behind the bracelet. |

The source names do not identify their functions. The classification above follows mesh dimensions, transformations, material regions, and a rendered inspection; hand roles follow their relative lengths and shapes, not semantic metadata. The JavaScript creates 11 logical component groups using loader node indices. All 25 original primitives remain in use.

## Geometry and material preservation

The application loads the source file byte-for-byte. It does not recalculate normals, decimate, remesh, add components, or rewrite materials in the GLB. Runtime `Object3D.attach()` retains original world transforms when organizing components. Explosion offsets are calculated from saved origins on every update, so reversing to zero reproduces the assembled transforms within floating-point tolerance. The browser integration test verifies every mesh's original world matrix after reassembly.

The original glass material is `alphaMode: BLEND` with alpha **1**, no transmission, and glTF's default metallic factor. It consequently behaves like an opaque reflective surface. The default **Studio vitrum** option uses a separate physical glass material with transmission and a low opacity. The untouched original material remains available by disabling that option in **STUDIUM**. Other source materials retain their original colors and roughness. Lighting, environment reflections, tone mapping, and subtle bloom create the photographic treatment.

## What cannot be revealed from this asset

There is **no modeled mechanical movement, gear train, escapement, balance wheel, winding mechanism, or independent caseback**. The case has no inner mechanism to expose. The animation deliberately does not present fabricated mechanical parts. A complete mechanical advertisement requires a more detailed movement asset or manual modeling.

The bracelet's links are contained in one mesh; they have no individual pivots. The paired spring bars are also a single mesh. Loose-island separation might yield some independent pieces, but connected links, overlapping surfaces, and material regions must be reviewed before treating them as manufactured components. Automated loose-part separation would not establish articulation, link order, or reliable joint pivots.

The source includes its own modeled brand inscriptions. They are retained along with the original geometry; AETERNUM is Latin placeholder branding for the website only.

## Optional Blender preparation

No Blender modification is required by the website. For further asset authoring:

```sh
blender -b --factory-startup --python-exit-code 1 \
  --python tools/prepare_blender.py -- \
  --output /workspace/scratch/watch-prepared.blend
```

This tested script imports the source, separates the existing case and dial material regions, assigns component metadata, and creates component collections. It creates 22 objects and retains 204,260 polygons. It refuses to overwrite an existing output. It never exports over the source GLB. The generated `/workspace/scratch/watch-prepared.blend` is an optional local authoring artifact, not a website dependency.

Manual authoring required for a richer asset:

1. Model or supply the actual movement, individual gears, and escapement; establish physically meaningful pivots and gear ratios.
2. Model a separate caseback and any missing inner case surfaces.
3. Review and separate bracelet links and paired spring bars, then set pivots and grouping manually.
4. Validate source inscriptions, shading, surface finishes, and a physically accurate glass export in Blender.
5. Export a **new** GLB and update the inspected component mapping. Do not overwrite the original without explicitly deciding to replace it.
