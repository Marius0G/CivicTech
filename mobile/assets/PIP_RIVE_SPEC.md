# Hop — Rive authoring contract (`pip.riv`)

The app's Rive renderer (`src/MascotRive.tsx`) drives the mascot **entirely through data binding**
(v2 `@rive-app/react-native`). For the runtime to bind, the `.riv` you author in the
[Rive editor](https://rive.app) must expose **exactly** the names below. Names are matched verbatim
— change one here and in `src/riveConfig.ts` together if you must rename.

## Required structure

| Thing | Name | Notes |
|---|---|---|
| Artboard | `Hop` | the frog, modelled on `../character.png` (blue body, gold crown, EU-star belly) |
| State machine | `Hop` | set as the artboard's default |
| ViewModel | (artboard default) | bound via `DataBindMode.Auto`; properties below live on it |

## Required data-binding properties (on the artboard's default ViewModel)

| Property | Type | Range | Drives |
|---|---|---|---|
| `level` | Number | `0`–`100` | **jaw open** for lip-sync. App pushes live voice loudness here every frame (0..1 amplitude × 100). Wire it to the mouth-open blend / a 1-D blend state. |
| `speaking` | Boolean | — | `true` while Hop talks. Use to blend **Idle ⇄ Talk** (e.g. enable the talking pose, subtle head bob). |
| `celebrate` | Trigger | — | fire **once** on success → jump + crown bounce + sparkle one-shot, then return to Idle. |

## Suggested state-machine states
- **Idle** — breathing, randomised blink, occasional look-around / weight shift (organic noise kills the "AI" stiffness).
- **Talk** — entered when `speaking` is true; mouth driven by `level` (closed at 0, wide near 100). Add fast attack / slow release in the blend so it never snaps shut mid-word.
- **Celebrate** — one-shot on the `celebrate` trigger.

## Authoring routes
1. **From scratch / from `character.png`** — best fidelity. Rig body, jaw, eyes (blink), arm (wave), crown. Expose the three properties above.
2. **Adapt a community frog** — e.g. [Frog Captcha](https://rive.app/community/files/4544-9229-frog-captcha/) (CC BY, openable in the editor). Restyle toward `character.png`, then add the Talk/`level` binding (it ships a captcha state machine, not a talking one).

## Going live
1. Export `pip.riv`, drop it at `mobile/assets/pip.riv`.
2. In `src/riveConfig.ts` set `HOP_RIVE_SOURCE = require('../assets/pip.riv')`.
3. Rebuild the native app: `cd mobile && npx expo run:android` (the Nitro Rive module needs a native build; Expo Go won't work).
4. The app auto-switches from the SVG fallback to Rive. Verify lip-sync by watching the jaw track Hop's voice; check Metro for any `useRive*` "property not found" errors (means a name here ≠ a name in the file).
