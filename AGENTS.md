# Site frame and vector rules

These rules apply to this project only. They cover frames and every other vector used by the site, excluding the Zoids decals and logomarks. The design commandments in ~/.codex/AGENTS.md still apply and are not repeated here.

## Geometry

- Every vertex uses integer coordinates in viewBox units.
- Every segment runs horizontal, vertical or at 45 degrees. Other angles, including near 45, are defects.
- Parallel outlines keep a minimum 2 units of separation on each axis. A 45 degree band uses a 2 unit offset on both axes, which is 1.41 units perpendicular. Keep that offset uniform within a drawing instead of mixing 2 and 3.
- Line thickness is consistent within a frame. A stroked outline is 2 units and scales with the frame like the filled bands. A filled band is 2 units wide.
- Irregular shapes get audited like the rest. No eyeballed notches, chamfers or curves.

## CSS chamfers

The same rules apply to `clip-path` shapes.

- A chamfer is 45 degrees only when its horizontal run equals the element height the polygon resolves against.
- With `box-sizing: border-box` and padding, percentage heights resolve against the content box. The language wedge is 28px tall because the readout is 44px with 8px vertical padding.
- A paired inner border sits 2px inside the outer edge. On a 45 degree edge that is 2.83 units horizontally.
- Overlapping tabs with negative margins keep their angle from their own height. Do not size a chamfer from the visual union of two elements.
- Text inside a chamfered control gets padding greater than the run so glyphs stay clear of the cut.

## Decals and logomarks

Zoids decals are excluded from the vertex, angle and thickness rules. Their outlines follow the source art.

Logomarks are excluded from the same rules: third-party brand marks such as the GitHub and Discord icons, and the site logotype's Xolonium glyph outlines. They follow their source outlines and are not redrawn.

## Enforcement

`node tools/audit_site_frames.mjs` checks every frame drawing in `site/index.html` (feature frames, section frames, language chevrons and the patcher ribbon) for integer vertices, 45 degree multiples, the 2 unit outline separation and self-crossing edges. It must exit 0 before any UI change is reported as done. New frame drawings must be added to its selection patterns.
