import type * as THREE from 'three';
import { TILE } from './Tiles';
import type { CorridorGenerator } from './CorridorGenerator';

/**
 * Resolve a position against the walls of the cell it currently occupies.
 * Because every wall spans a full cell edge, clamping per-edge is sufficient
 * and produces natural wall-sliding (X and Z handled independently).
 */
export function resolveCollision(gen: CorridorGenerator, pos: THREE.Vector3, radius: number): void {
  const { cx, cz } = gen.worldToCell(pos.x, pos.z);
  const x0 = cx * TILE;
  const z0 = cz * TILE;

  if (gen.hasWall(cx, cz, 'W') && pos.x < x0 + radius) pos.x = x0 + radius;
  if (gen.hasWall(cx, cz, 'E') && pos.x > x0 + TILE - radius) pos.x = x0 + TILE - radius;
  if (gen.hasWall(cx, cz, 'N') && pos.z < z0 + radius) pos.z = z0 + radius;
  if (gen.hasWall(cx, cz, 'S') && pos.z > z0 + TILE - radius) pos.z = z0 + TILE - radius;
}
