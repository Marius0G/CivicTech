# Hop in 3D — Blender MCP build plan

Goal: author **our** mascot (the crowned EU youth-buddy frog from `../character.png`) as a rigged,
cartoonish 3D model, exported as **GLB with morph targets + clips**, then render it in the app with
`@react-three/fiber` and drive the mouth from the live `audioLevel` envelope (true lip-sync).

## Which server (answered)
We use the **official Blender MCP** (blender.org/lab — repo `projects.blender.org/lab/blender_mcp`),
NOT the third-party `ahujasid/blender-mcp`. It's the better fit: first-party (best Blender 5.1
compatibility), exposes **`execute_blender_code`** (full Python control to model/rig/animate/export),
**screenshot tools** (`get_screenshot_of_window_as_image` → I can SEE the frog as I build it),
**`get_python_api_docs` / `search_api_docs` / `search_manual_docs`** (look up correct 5.1 API), plus
scene-summary + render tools. Only thing it lacks vs third-party: Hyper3D Rodin / PolyHaven /
Sketchfab — so **no AI image→3D**; we model the frog **procedurally in Python** instead (clean,
low-poly, mobile-friendly, no API key, fully matches `character.png` by hand).

Architecture: `Claude Code ⇐stdio⇒ blender-mcp (official) ⇐TCP :9876⇒ Blender add-on`.

## Install state (done)
- Official MCP server installed → `C:\bmcp\venv\Scripts\blender-mcp.exe` (blender-mcp **1.0.0**,
  Python 3.14). Registered in `../.mcp.json` (command = that exe).
- The deep manual data tree overflows Windows MAX_PATH under temp dirs, so it lives at the short
  path `C:\bmcp`. (Old third-party venv `C:\Users\mariu\.blender-mcp` is unused — safe to delete.)
- You've already installed + started the **official add-on** in Blender (listening on `:9876`).

## Remaining gate before I can model
**Restart Claude Code** so it loads the `blender` MCP server (it'll ask you to approve it). Its tools
are UNAVAILABLE until then. After restart, say "connected" and I'll call `get_objects_summary` /
`get_screenshot_of_window_as_image` to confirm the link, then start building.
- ⚠️ If `execute_blender_code` errors on Blender 5.1 API specifics, I'll use `search_api_docs` to
  correct calls on the fly.

## Build workflow (procedural, via execute_blender_code)
1. **Block-out** the cartoon frog from primitives to match `character.png`: round body + cream belly,
   two eye bumps, big eyes, wide smile, gold crown, EU-star belly ring, webbed feet, a raised waving
   hand. Subdiv + smooth for the soft cartoon look. Verify with screenshots, iterate.
2. **Cleanup** — low tri count (target ≲ 15k), recenter origin to feet, +Y up, ~1 unit tall, simple
   flat/vertex-colour materials (cheap on mobile).
3. **Rig for OUR contract** (what stock models never have):
   - **Shape keys (morph targets):** `mouthOpen` (0→1 for lip-sync), `blink`, optional `smile`.
   - Optional light armature with a **jaw bone** if shape keys aren't enough.
4. **Animation clips:** `Idle` (breath + occasional blink), `Talk` (subtle head bob — the mouth is
   driven LIVE by `mouthOpen`, not baked), `Celebrate` (jump + crown bounce).
5. **Export** `pip.glb` → `mobile/assets/pip.glb` with morph targets + animations, GLB binary, +Y up,
   transforms applied.

## Export contract (RN side binds to these EXACT names)
| Thing | Name | Type | Drives |
|---|---|---|---|
| Morph target | `mouthOpen` | 0..1 | jaw open ← `audioLevel` (lip-sync) |
| Morph target | `blink` | 0..1 | eyelids (random idle cadence) |
| Clip | `Idle` | loop | default |
| Clip | `Talk` | loop | crossfade in while `speaking` |
| Clip | `Celebrate` | one-shot | on success |
| Root | ~1 unit tall, origin at feet, +Y up | | consistent sizing in r3f |

## App integration (after `pip.glb` exists)
- Add `@react-three/fiber` + `expo-gl` + `three` (native dep → needs `expo run:android`, like Rive).
- New `Mascot3D.tsx` (same `MascotProps`): load `pip.glb`, set
  `mesh.morphTargetInfluences[mouthOpen]` from `levelValue` each frame, crossfade `Idle`↔`Talk` on
  `speaking`, play `Celebrate` on `celebrate`.
- A GL canvas is heavy for tiny instances: **Mascot3D on the hero/voice screens, keep MascotSvg on
  the 40px chat header / tab bar.** The `Mascot.tsx` switch already supports per-instance choice.
