import * as THREE from 'three';
import type { FacilityMaterials } from './Materials';

export const TILE = 4; // cell size in world units
export const WALL_H = 3.2; // ceiling height
export const EYE = 1.62; // camera eye height

export type Dir = 'N' | 'E' | 'S' | 'W';
export const DIRS: Dir[] = ['N', 'E', 'S', 'W'];
export const DELTA: Record<Dir, [number, number]> = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
export const OPPOSITE: Record<Dir, Dir> = { N: 'S', S: 'N', E: 'W', W: 'E' };

export type PropKind = 'pod' | 'slab' | 'pillar' | 'cables' | 'machine';

export interface BuiltCell {
  group: THREE.Group;
  geoms: THREE.BufferGeometry[];
  lights: { mat: THREE.MeshStandardMaterial; base: number; phase: number }[];
}

const wallGeo = new THREE.PlaneGeometry(TILE, WALL_H);
const flatGeo = new THREE.PlaneGeometry(TILE, TILE);

/**
 * Build the meshes for one carved cell. Walls are emitted only where
 * `walls[dir]` is true; floor + ceiling always; an emissive fixture if `light`.
 */
export function buildCell(
  cx: number,
  cz: number,
  walls: Record<Dir, boolean>,
  mats: FacilityMaterials,
  opts: { light: boolean; stair: boolean; elevator: boolean; prop?: PropKind },
): BuiltCell {
  const group = new THREE.Group();
  const geoms: BuiltCell['geoms'] = [];
  const lights: BuiltCell['lights'] = [];
  const x0 = cx * TILE;
  const z0 = cz * TILE;
  const cxw = x0 + TILE / 2;
  const czw = z0 + TILE / 2;

  // floor
  const floor = new THREE.Mesh(flatGeo, mats.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cxw, 0, czw);
  group.add(floor);

  // ceiling
  const ceil = new THREE.Mesh(flatGeo, mats.ceiling);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(cxw, WALL_H, czw);
  group.add(ceil);

  const addWall = (px: number, pz: number, ry: number) => {
    const m = new THREE.Mesh(wallGeo, mats.wall);
    m.position.set(px, WALL_H / 2, pz);
    m.rotation.y = ry;
    group.add(m);
  };
  if (walls.N) addWall(cxw, z0, 0);
  if (walls.S) addWall(cxw, z0 + TILE, Math.PI);
  if (walls.W) addWall(x0, czw, Math.PI / 2);
  if (walls.E) addWall(x0 + TILE, czw, -Math.PI / 2);

  // ceiling fluorescent fixture
  if (opts.light) {
    const mat = mats.light.clone();
    const fix = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), mat);
    fix.rotation.x = Math.PI / 2;
    fix.position.set(cxw, WALL_H - 0.02, czw);
    group.add(fix);
    geoms.push(fix.geometry as THREE.BufferGeometry);
    lights.push({ mat, base: mat.emissiveIntensity, phase: Math.random() * 10 });
  }

  // floor marker for stair / elevator
  if (opts.stair || opts.elevator) {
    const mk = new THREE.Mesh(new THREE.PlaneGeometry(TILE * 0.7, TILE * 0.7), opts.stair ? mats.stair : mats.elevator);
    mk.rotation.x = -Math.PI / 2;
    mk.position.set(cxw, 0.02, czw);
    group.add(mk);
    geoms.push(mk.geometry as THREE.BufferGeometry);
  }

  // set-piece props (only placed in open rooms)
  if (opts.prop) buildProp(opts.prop, group, geoms, mats, cxw, czw);

  return { group, geoms, lights };
}

function buildProp(
  kind: PropKind,
  group: THREE.Group,
  geoms: THREE.BufferGeometry[],
  mats: FacilityMaterials,
  cxw: number,
  czw: number,
): void {
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    group.add(m);
    geoms.push(geo);
    return m;
  };

  if (kind === 'pillar') {
    add(new THREE.BoxGeometry(0.6, WALL_H, 0.6), mats.propDark, cxw, WALL_H / 2, czw);
  } else if (kind === 'slab') {
    add(new THREE.BoxGeometry(1.9, 0.2, 0.9), mats.propDark, cxw, 0.85, czw); // table top
    add(new THREE.BoxGeometry(1.7, 0.7, 0.7), mats.propDark, cxw, 0.4, czw); // base
  } else if (kind === 'pod') {
    add(new THREE.CylinderGeometry(0.62, 0.62, 0.25, 14), mats.propDark, cxw, 0.12, czw); // base
    add(new THREE.CylinderGeometry(0.55, 0.55, 2.0, 14, 1, true), mats.propGlass, cxw, 1.2, czw); // glass tube
    add(new THREE.CylinderGeometry(0.62, 0.62, 0.2, 14), mats.propDark, cxw, 2.25, czw); // cap
  } else if (kind === 'cables') {
    for (let i = 0; i < 5; i++) {
      const len = 0.8 + Math.random() * 1.4;
      const ox = (Math.random() - 0.5) * 2.4;
      const oz = (Math.random() - 0.5) * 2.4;
      add(new THREE.CylinderGeometry(0.025, 0.025, len, 5), mats.propDark, cxw + ox, WALL_H - len / 2, czw + oz);
    }
  } else { // machine
    add(new THREE.BoxGeometry(2.4, 2.1, 1.0), mats.propDark, cxw, 1.05, czw - 1.0);
    const panel = add(new THREE.PlaneGeometry(1.6, 1.0), mats.propGlass, cxw, 1.2, czw - 0.49);
    panel.rotation.y = 0;
  }
}

/** Free the per-cell geometries created above (shared geos are not disposed). */
export function disposeBuilt(b: BuiltCell): void {
  b.geoms.forEach((g) => g.dispose());
  b.lights.forEach((l) => l.mat.dispose());
}
