# Hybrid mechanical watch

The showcase combines two inspected GLBs: the brown-and-steel luxury exterior and bracelet with the newly supplied Arnold & Son mechanical interior. Both uploaded source files remain byte-for-byte intact. The old plain chronograph face is excluded from the visible hybrid assembly.

## Source inventory

| Source | Original meshes | Prepared meshes | Preparation selection |
| --- | --- | --- | --- |
| `watch__luxury_wristwatch_3d_model.glb` | 56 | 27 | Case/bezel, glass, main hands, crown, lugs, bracelet, clasp, caseback |
| `arnoldson_watch_mechanical.glb` | 83 | 74 | Movement frame, bridges, screws, bearings, 16 distinct gear meshes, tourbillon assembly |

Source preparation selects **101 original meshes** in 30 groups. The display derivative replaces six legacy hand/hub meshes with 15 designed face/hand meshes: **110 meshes in 31 groups**, totaling **580,727 triangles**. Additions include a solid brown plate with an actual open-heart aperture, 60 applied indices, chapter and aperture rings, Roman numerals, sword hands with ivory inlays, a seconds needle and cap.

Full affine world transforms are baked before reparenting, preserving shear from the uploaded nonuniform hierarchy. Small bevels and weighted normals improve edge reflections. The movement is rotated 180 degrees in the dial plane to place the balance assembly at six o'clock, then recessed 0.075 normalized units. Case dimensions and source images are retained.

`face-depths.json` records evaluated vertex bounds along the face normal. Every gear and movement surface is below the dial's back surface; every hand is above the highest face decoration. Browser tests independently verify this order from the loaded geometry through six reveal/reversal positions, plus exact reassembly. The dial lifts before the movement and bridges, so mechanical parts do not pass through its solid face. Both source GLBs remain byte-identical. Regenerate the inventories, including the derivative:

```sh
python3 tools/inspect_model.py --output docs/model-inventory.json
```

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

Chestnut recoloring preserves embedded texture detail. Physical variants add satin steel, machined gold, polished hairlines, ruby-like bearings and sapphire-like glass. Six local normal/roughness maps come from `tools/generate_surface_maps.py`; source images are not edited. Source materials remain available through STUDIUM. HDR studio softboxes, champagne rim light, restrained bloom, warm grading, a fine static grain and a vignette complete the treatment.

The renderer redraws when transforms, camera controls or materials change, and stays idle when the view is static. Pixel ratio is capped at 1.5. The dense mechanical model is intentionally retained without decimation; runtime loads one approximately 24 MB refined GLB. Both originals remain available for authoring.

## Blender authoring helper

```sh
blender -b --factory-startup --python-exit-code 1 \
  --python tools/prepare_blender.py -- \
  --output /workspace/scratch/hybrid-watch-prepared.blend
```

The tested helper imports both sources, selects the same meshes as the website, preserves their world geometry while normalizing the assembly, and organizes 30 component collections. Verified output: 101 mesh objects and 491,161 polygons. It refuses to overwrite an existing output and does not re-export either GLB. Refine its output with `tools/refine_geometry.py`; `tools/render_hero.py` provides a Cycles product render. Interactive materials and scroll choreography run in Three.js.

Compound gear meshes require manual separation to expose every manufactured wheel independently. Validated gear ratios, functional escapement simulation, certified crystal clearance and production CAD reconstruction require engineering references and manual work.

## Attribution

Both sources are licensed under **CC BY 4.0**, as recorded in their embedded metadata. Attribution appears in the website's STUDIUM panel.

**Watch – Luxury Wristwatch 3D Model**, by **DevPoly3D**:

- https://sketchfab.com/DevPoly3D
- https://sketchfab.com/3d-models/watch-luxury-wristwatch-3d-model-693e3e5fc41b42c5af35bc965ab70014

**arnold&son watch mechanical**, by **abdelghani.0**:

- https://sketchfab.com/abdelghani.0
- https://sketchfab.com/3d-models/arnoldson-watch-mechanical-4dc8d4dd90cb4b4e9752bcf988f357cf

License: https://creativecommons.org/licenses/by/4.0/

Presentation modifications: mesh selection and combination, uniform display normalization, reversible grouping and animation, replacement dial/hands, recessed and rotated movement, micro bevels and weighted normals, brown recoloring, studio material treatments and cinematic lighting/postprocessing. Source inscriptions and image maps are retained. AETERNUM remains Latin placeholder website branding.
