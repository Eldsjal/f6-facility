import * as THREE from 'three';
import { mulberry32, randInt, chance, type Rng } from '../core/Random';
import type { FacilityMaterials } from './Materials';
import {
  TILE, DIRS, DELTA, OPPOSITE,
  buildCell, disposeBuilt, type Dir, type BuiltCell, type PropKind,
} from './Tiles';

export interface Cell {
  cx: number;
  cz: number;
  walls: Record<Dir, boolean>; // true = wall present (blocked)
  hasLight: boolean;
  type: 'corridor' | 'room' | 'stair' | 'elevator' | 'entry';
  prop?: PropKind;
}

export interface FloorTheme {
  name: string;
  light: number;   // fluorescent emissive hue
  wall: number;    // wall tint (multiplies grime)
  floor: number;   // floor tint
  fog: number;     // fog + background colour
  ambient: number; // ambient light colour
}

// each sublevel feels like a different wing of the facility
const FLOOR_THEMES: FloorTheme[] = [
  { name: 'INTAKE',  light: 0xfff2cc, wall: 0xaab0a0, floor: 0x6a6a6e, fog: 0x05060a, ambient: 0x223044 },
  { name: 'BREACH',  light: 0xff5a33, wall: 0xb88a7a, floor: 0x6e524a, fog: 0x0a0403, ambient: 0x3a1c16 },
  { name: 'GROWTH',  light: 0xb6ffa0, wall: 0x9ab088, floor: 0x5a6a50, fog: 0x040a06, ambient: 0x1c3a22 },
  { name: 'CRYO',    light: 0xbfe2ff, wall: 0x9ab0c4, floor: 0x586472, fog: 0x04060c, ambient: 0x1a2a4a },
  { name: 'ARCHIVE', light: 0xffc25a, wall: 0xc0a878, floor: 0x6c5e42, fog: 0x0a0703, ambient: 0x3a2e1a },
];

const STREAM_RADIUS = 6; // cells built around the player (Chebyshev)
const PROPS: PropKind[] = ['pod', 'slab', 'cables', 'pillar', 'machine'];

/**
 * Per-floor grid maze. The logical maze for a floor is generated up front
 * (deterministic from the seed) but meshes are streamed in/out around the
 * player so draw calls stay bounded and memory stays flat.
 */
export class CorridorGenerator {
  size = 24;
  floorIndex = 0;
  fogDensity = 0.085;
  theme: FloorTheme = FLOOR_THEMES[0];
  entry: { cx: number; cz: number } = { cx: 0, cz: 0 };
  stair: { cx: number; cz: number } = { cx: 0, cz: 0 };
  elevator: { cx: number; cz: number } = { cx: 0, cz: 0 };

  private cells: Cell[] = [];
  private built = new Map<string, BuiltCell>();
  private rng: Rng = mulberry32(1);

  constructor(private scene: THREE.Scene, private mats: FacilityMaterials) {}

  private idx(cx: number, cz: number): number { return cz * this.size + cx; }
  private key(cx: number, cz: number): string { return `${cx},${cz}`; }
  inBounds(cx: number, cz: number): boolean { return cx >= 0 && cz >= 0 && cx < this.size && cz < this.size; }
  cellAt(cx: number, cz: number): Cell | undefined { return this.inBounds(cx, cz) ? this.cells[this.idx(cx, cz)] : undefined; }

  hasWall(cx: number, cz: number, dir: Dir): boolean {
    const c = this.cellAt(cx, cz);
    if (!c) return true;
    return c.walls[dir];
  }
  passageOpen(cx: number, cz: number, dir: Dir): boolean { return !this.hasWall(cx, cz, dir); }

  worldToCell(x: number, z: number): { cx: number; cz: number } {
    return { cx: Math.floor(x / TILE), cz: Math.floor(z / TILE) };
  }
  cellCenter(cx: number, cz: number, y = 0): THREE.Vector3 {
    return new THREE.Vector3(cx * TILE + TILE / 2, y, cz * TILE + TILE / 2);
  }

  // ----------------------------------------------------------- generation
  generateFloor(seed: number, size: number, floorIndex: number): void {
    this.clearAll();
    this.size = size;
    this.floorIndex = floorIndex;
    this.fogDensity = Math.min(0.16, 0.082 + floorIndex * 0.012);
    this.rng = mulberry32(seed);

    // pick this floor's wing and recolour the shared materials to match
    this.theme = FLOOR_THEMES[floorIndex % FLOOR_THEMES.length];
    this.mats.light.emissive.setHex(this.theme.light);
    this.mats.wall.color.setHex(this.theme.wall);
    this.mats.floor.color.setHex(this.theme.floor);

    // init every cell as fully walled
    this.cells = new Array(size * size);
    for (let cz = 0; cz < size; cz++) {
      for (let cx = 0; cx < size; cx++) {
        this.cells[this.idx(cx, cz)] = {
          cx, cz,
          walls: { N: true, E: true, S: true, W: true },
          hasLight: false,
          type: 'corridor',
        };
      }
    }

    this.carveMaze();
    this.braid(0.16);
    this.carveRooms(Math.max(3, Math.floor(size / 5)));

    // entry near centre; stair = farthest; elevator = farthest from stair
    this.entry = { cx: (size / 2) | 0, cz: (size / 2) | 0 };
    this.stair = this.farthestFrom(this.entry);
    this.elevator = this.farthestFrom(this.stair);
    for (const sp of [this.entry, this.stair, this.elevator]) {
      const c = this.cellAt(sp.cx, sp.cz)!;
      c.prop = undefined; // keep these cells walkable
    }
    this.cellAt(this.entry.cx, this.entry.cz)!.type = 'entry';
    this.cellAt(this.stair.cx, this.stair.cz)!.type = 'stair';
    this.cellAt(this.elevator.cx, this.elevator.cz)!.type = 'elevator';

    // lights: sparse grid pattern + markers always lit
    for (const c of this.cells) {
      if ((c.cx + c.cz) % 3 === 0 || chance(this.rng, 0.18)) c.hasLight = true;
    }
    this.cellAt(this.stair.cx, this.stair.cz)!.hasLight = true;
    this.cellAt(this.elevator.cx, this.elevator.cz)!.hasLight = true;
    this.cellAt(this.entry.cx, this.entry.cz)!.hasLight = true;
  }

  private openWall(cx: number, cz: number, dir: Dir): void {
    const a = this.cellAt(cx, cz);
    const [dx, dz] = DELTA[dir];
    const b = this.cellAt(cx + dx, cz + dz);
    if (!a || !b) return;
    a.walls[dir] = false;
    b.walls[OPPOSITE[dir]] = false;
  }

  private carveMaze(): void {
    const visited = new Uint8Array(this.size * this.size);
    const start = { cx: (this.size / 2) | 0, cz: (this.size / 2) | 0 };
    const stack: { cx: number; cz: number }[] = [start];
    visited[this.idx(start.cx, start.cz)] = 1;

    while (stack.length) {
      const cur = stack[stack.length - 1];
      const options: Dir[] = [];
      for (const dir of DIRS) {
        const [dx, dz] = DELTA[dir];
        const nx = cur.cx + dx;
        const nz = cur.cz + dz;
        if (this.inBounds(nx, nz) && !visited[this.idx(nx, nz)]) options.push(dir);
      }
      if (options.length) {
        const dir = options[randInt(this.rng, 0, options.length - 1)];
        const [dx, dz] = DELTA[dir];
        this.openWall(cur.cx, cur.cz, dir);
        const nx = cur.cx + dx;
        const nz = cur.cz + dz;
        visited[this.idx(nx, nz)] = 1;
        stack.push({ cx: nx, cz: nz });
      } else {
        stack.pop();
      }
    }
  }

  /** Remove some walls to add loops, so the facility is less dead-end-heavy. */
  private braid(prob: number): void {
    for (const c of this.cells) {
      if (!chance(this.rng, prob)) continue;
      const closed = DIRS.filter((d) => {
        const [dx, dz] = DELTA[d];
        return c.walls[d] && this.inBounds(c.cx + dx, c.cz + dz);
      });
      if (closed.length) this.openWall(c.cx, c.cz, closed[randInt(this.rng, 0, closed.length - 1)]);
    }
  }

  private carveRooms(count: number): void {
    for (let i = 0; i < count; i++) {
      const w = randInt(this.rng, 2, 4);
      const h = randInt(this.rng, 2, 4);
      const ox = randInt(this.rng, 1, this.size - w - 1);
      const oz = randInt(this.rng, 1, this.size - h - 1);
      // each room is a themed set-piece: one dominant prop kind + scatter
      const feature = PROPS[randInt(this.rng, 0, PROPS.length - 1)];
      for (let z = oz; z < oz + h; z++) {
        for (let x = ox; x < ox + w; x++) {
          const c = this.cellAt(x, z)!;
          c.type = 'room';
          c.hasLight = c.hasLight || chance(this.rng, 0.5);
          if (x < ox + w - 1) this.openWall(x, z, 'E');
          if (z < oz + h - 1) this.openWall(x, z, 'S');
          // populate with props, biased toward the room's feature
          const r = this.rng();
          if (r < 0.42) c.prop = chance(this.rng, 0.6) ? feature : PROPS[randInt(this.rng, 0, 3)];
        }
      }
    }
  }

  // ----------------------------------------------------------- graph queries
  openNeighbors(cx: number, cz: number): Dir[] {
    return DIRS.filter((d) => this.passageOpen(cx, cz, d));
  }

  greedyStepToward(from: { cx: number; cz: number }, target: { cx: number; cz: number }): Dir | null {
    let best: Dir | null = null;
    let bestDist = Infinity;
    for (const d of this.openNeighbors(from.cx, from.cz)) {
      const [dx, dz] = DELTA[d];
      const dist = Math.abs(from.cx + dx - target.cx) + Math.abs(from.cz + dz - target.cz);
      if (dist < bestDist) { bestDist = dist; best = d; }
    }
    return best;
  }

  /** Grid line-of-sight in world coordinates (no corner-cutting through walls). */
  lineOfSight(ax: number, az: number, bx: number, bz: number): boolean {
    const dx = bx - ax;
    const dz = bz - az;
    const dist = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(dist / 0.4));
    let prev = this.worldToCell(ax, az);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const c = this.worldToCell(ax + dx * t, az + dz * t);
      if (c.cx !== prev.cx || c.cz !== prev.cz) {
        const ddx = c.cx - prev.cx;
        const ddz = c.cz - prev.cz;
        if (Math.abs(ddx) + Math.abs(ddz) !== 1) return false; // diagonal corner cut
        const dir: Dir = ddx === 1 ? 'E' : ddx === -1 ? 'W' : ddz === 1 ? 'S' : 'N';
        if (!this.passageOpen(prev.cx, prev.cz, dir)) return false;
        prev = c;
      }
    }
    return true;
  }

  private farthestFrom(src: { cx: number; cz: number }): { cx: number; cz: number } {
    const dist = new Int32Array(this.size * this.size).fill(-1);
    const q: { cx: number; cz: number }[] = [src];
    dist[this.idx(src.cx, src.cz)] = 0;
    let far = src;
    let farD = 0;
    while (q.length) {
      const cur = q.shift()!;
      const dCur = dist[this.idx(cur.cx, cur.cz)];
      if (dCur > farD) { farD = dCur; far = cur; }
      for (const d of this.openNeighbors(cur.cx, cur.cz)) {
        const [dx, dz] = DELTA[d];
        const nx = cur.cx + dx;
        const nz = cur.cz + dz;
        if (this.inBounds(nx, nz) && dist[this.idx(nx, nz)] < 0) {
          dist[this.idx(nx, nz)] = dCur + 1;
          q.push({ cx: nx, cz: nz });
        }
      }
    }
    return far;
  }

  randomCellFar(from: { cx: number; cz: number }, minDist: number): { cx: number; cz: number } {
    for (let i = 0; i < 80; i++) {
      const cx = randInt(this.rng, 0, this.size - 1);
      const cz = randInt(this.rng, 0, this.size - 1);
      if (Math.abs(cx - from.cx) + Math.abs(cz - from.cz) >= minDist) return { cx, cz };
    }
    return this.farthestFrom(from);
  }

  // ----------------------------------------------------------- streaming
  update(playerPos: THREE.Vector3): void {
    const pc = this.worldToCell(playerPos.x, playerPos.z);
    // build near
    for (let cz = pc.cz - STREAM_RADIUS; cz <= pc.cz + STREAM_RADIUS; cz++) {
      for (let cx = pc.cx - STREAM_RADIUS; cx <= pc.cx + STREAM_RADIUS; cx++) {
        if (!this.inBounds(cx, cz)) continue;
        const k = this.key(cx, cz);
        if (this.built.has(k)) continue;
        const c = this.cells[this.idx(cx, cz)];
        const b = buildCell(cx, cz, c.walls, this.mats, {
          light: c.hasLight,
          stair: c.type === 'stair',
          elevator: c.type === 'elevator',
          prop: c.prop,
        });
        this.scene.add(b.group);
        this.built.set(k, b);
      }
    }
    // dispose far
    for (const [k, b] of this.built) {
      const [bx, bz] = k.split(',').map(Number);
      if (Math.max(Math.abs(bx - pc.cx), Math.abs(bz - pc.cz)) > STREAM_RADIUS + 1) {
        this.scene.remove(b.group);
        disposeBuilt(b);
        this.built.delete(k);
      }
    }
  }

  updateLights(dt: number, t: number): void {
    for (const b of this.built.values()) {
      for (const l of b.lights) {
        // mostly steady, with occasional fluorescent stutter
        const flick = Math.sin((t + l.phase) * 11) > 0.97 || Math.random() < 0.006 ? 0.18 : 1;
        l.mat.emissiveIntensity = l.base * flick;
      }
    }
  }

  clearAll(): void {
    for (const b of this.built.values()) {
      this.scene.remove(b.group);
      disposeBuilt(b);
    }
    this.built.clear();
  }
}
