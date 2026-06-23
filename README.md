# F6 FACILITY

A first-person analog-horror survival game for the browser. Built with TypeScript +
[Three.js](https://threejs.org/) (WebGL). Two interlocking modes:

- **The Lab** — a safe containment console. Take a subject that still looks almost human and,
  instrument by instrument, refine it into a monster. *Single-click* an instrument to select it;
  *double-click* to commit the experiment. Each subject mutates in stages (PRISTINE → UNCANNY →
  DISTRESSED → MUTATING → **MONSTER**), banks score, and is **released into the facility**.
- **The Corridors** — first-person survival in an endless, procedurally-streamed facility. The
  creatures you made roam and hunt you. Your flashlight battery (**power**) and **sanity** drain
  in the dark. Go **deeper** (find the red stairwell) for more score. Get caught, or break down,
  and the run ends. Permadeath — beat your best.

The five creatures are **drawn procedurally** (original art inspired by the reference imagery, not
the photos) as camera-facing **billboard sprites**, rendered through a PSX/VHS post-processing
stack (bloom, film grain, scanlines, chromatic aberration, vignette, flicker) wired to your sanity
and the threat. Because each creature is generated at a `horror` level, the Lab shows the same
subject mutating from calm to monstrous. All audio is **synthesized at runtime** (WebAudio) — no
sampled assets, no licensing.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

Then open the page and click **ENTER THE FACILITY**. Click the canvas to capture the mouse
(pointer lock); press <kbd>Esc</kbd> to pause.

Production build (static, deployable to itch.io / Netlify / GitHub Pages):

```bash
npm run build      # type-checks then bundles to dist/
npm run preview
```

## Controls

| | |
|---|---|
| `W A S D` / arrows | move |
| mouse | look |
| `Shift` | run (louder — creatures hear you) |
| `F` | toggle flashlight |
| `E` | interact (return to the Lab at the amber elevator) |
| walk onto red stairwell | descend a sublevel |
| in the Lab: **click** | select an instrument |
| in the Lab: **double-click** | commit the experiment |

## Project layout

```
src/
  core/        Engine, PostProcessing (the VHS look), Input, Random
  world/       CorridorGenerator (streamed maze), Tiles, Collision, Materials
  player/      PlayerController (pointer-lock FPS), Flashlight
  creatures/   CreatureSpec, CreatureArt (procedural art), Billboard, Creature (AI FSM), CreatureManager
  lab/         ExperimentMachine, SubjectView, LabUI
  audio/       AudioManager + synth/ (ambient, heartbeat, footsteps, stingers)
  ui/          HUD, Menu
  game/        Game (top FSM), RunState, modes/{LabMode, CorridorMode}
```

To add or change a creature, add a `draw` entry in `src/creatures/CreatureArt.ts`
(drawn at a `horror` level 0→1) and a tuning row in `src/creatures/CreatureSpec.ts`.
