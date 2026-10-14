# Hybrid mechanical watch

The showcase combines two inspected GLBs: the brown-and-steel luxury exterior and bracelet with the newly supplied Arnold & Son mechanical interior. Both uploaded source files remain byte-for-byte intact. The old plain chronograph face is excluded from the visible hybrid assembly.

## Source inventory

| Source | Original meshes | Selected meshes | Used for |
| --- | --- | --- | --- |
| `watch__luxury_wristwatch_3d_model.glb` | 56 | 27 | Case/bezel, glass, main hands, crown, lugs, bracelet, clasp, caseback |
| `arnoldson_watch_mechanical.glb` | 83 | 74 | Movement frame, bridges, screws, bearings, 16 distinct gear meshes, tourbillon assembly |

The hybrid has **101 selected meshes**, **30 independently controlled component groups**, and **491,161 triangles**. Selection, centering, scales, and source gear pivots are defined in `src/model-config.json`. The full inventories, original material names, native parent hierarchy, checksums, bounds, and selection roles are in `model-inventory.json`; regenerate them with:

```sh
python3 tools/inspect_model.py --output docs/model-inventory.json
```

Both native files were imported and rendered in Blender. Their nested matrix and quaternion transforms were inspected before selection. Runtime grouping uses glTF source node indices and validates coverage and duplicate assignments. Full affine matrices are retained when regrouping; decomposing the nested nonuniform scales into position/rotation/scale would lose shear and alter assembled shapes. Omitted meshes are removed from the displayed source trees, preventing duplicate casings and opaque source cover plates from hiding the mechanism.

## What was combined

The exterior retains its case/bezel regions, brown bracelet inserts, crown, clasp, clear glass, hands and caseback. Its 29 dial/subdial mesh regions are omitted, so the original flat chronograph texture no longer covers the gear train.

The mechanical source contributes its bridges and plates, small structural pieces, jewel-like bearings, named spur-gear meshes and tourbillon. Its duplicate outer case, crown, cover plates and redundant time display are omitted. The mechanism receives one uniform scale and translation to fit the exterior opening. No vertices, UVs, normals, teeth or source image pixels are rewritten.

All 16 `Spur Gear` source meshes are separately selectable and animated. Some contain compound wheel geometry, so “16 gear meshes” does not imply 16 individually manufactured wheels. Gear pivots use their authored parent origins; the tourbillon pivot uses its authored assembly parent. Explosion positions always derive from saved origins, and rotation angles derive from progress, making reversal deterministic.

This is a designed hybrid visualization. Its combination and motion are not a certified reconstruction of a manufactured watch. Gear directions and rotation speeds illustrate the mechanism; tooth ratios and physical clearances are not engineering-validated. The mechanical source includes one authored animation clip; it is retained in the source file. The website uses its own reversible progress choreography instead of mixing a looping source clip with the exploded transforms.

## Scroll choreography

`src/choreography.js` defines five explicit poses:

1. **0%:** close assembled front view; slightly pitched and rolled.
2. **22%:** front three-quarter rotation as the crystal and hands lift.
3. **46%:** side cutaway while movement and bridges separate.
4. **70%:** rear view revealing depth and the separated caseback.
5. **100%:** return toward a front three-quarter view after almost a full revolution, with individually spread gear meshes and tourbillon visible.

The page scroll, slider and play button all share the same progress state. Gear and tourbillon rotations follow progress and reverse exactly. Camera position, target, model yaw, pitch and roll use eased interpolation between the same pose milestones. Manual orbiting remains available; reset restores the current chapter camera.

Reduced-motion preferences disable the automatic model/camera turn. Explicit slider and scroll actions still control part separation. The display setting can enable the cinematic turn when desired.

## Presentation and performance

The Three.js canvas spans the complete viewport behind the typography and controls. The watch is deliberately oversized, with editorial gradients preserving text legibility. A responsive camera and floating frosted controls support portrait and short landscape layouts.

Chestnut recoloring preserves embedded texture detail. Physical studio variants add satin steel, warm gold, restrained clearcoat, ruby-like bearing accents and clear glass. Source materials remain available through STUDIUM. HDR studio softboxes, champagne rim light, restrained bloom, warm grading, a fine static grain and a vignette complete the treatment.

The renderer redraws when transforms, camera controls or materials change, and stays idle when the view is static. Pixel ratio is capped at 1.5. The dense mechanical model is intentionally retained without decimation; the two intact GLBs total approximately 28 MB before transport compression.

## Blender authoring helper

```sh
blender -b --factory-startup --python-exit-code 1 \
  --python tools/prepare_blender.py -- \
  --output /workspace/scratch/hybrid-watch-prepared.blend
```

The tested helper imports both sources, selects the same meshes as the website, preserves their world geometry while normalizing the assembly, and organizes 30 component collections. Verified output: 101 mesh objects and 491,161 polygons. It refuses to overwrite an existing output and does not re-export either GLB. Runtime cinematic materials and scroll choreography are implemented by the website.

## Attribution

Both sources are licensed under **CC BY 4.0**, as recorded in their embedded metadata. Attribution appears in the website's STUDIUM panel.

**Watch – Luxury Wristwatch 3D Model**, by **DevPoly3D**:

- https://sketchfab.com/DevPoly3D
- https://sketchfab.com/3d-models/watch-luxury-wristwatch-3d-model-693e3e5fc41b42c5af35bc965ab70014

**arnold&son watch mechanical**, by **abdelghani.0**:

- https://sketchfab.com/abdelghani.0
- https://sketchfab.com/3d-models/arnoldson-watch-mechanical-4dc8d4dd90cb4b4e9752bcf988f357cf

License: https://creativecommons.org/licenses/by/4.0/

Presentation modifications: mesh selection and combination, uniform display normalization, reversible grouping and animation, brown recoloring, studio material treatments and cinematic lighting/postprocessing. Source inscriptions and image maps are retained. AETERNUM remains Latin placeholder website branding.
