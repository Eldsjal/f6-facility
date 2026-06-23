import * as THREE from 'three';
import type { CreatureSpec } from './CreatureSpec';
import type { CorridorGenerator } from '../world/CorridorGenerator';
import { DELTA, OPPOSITE, type Dir } from '../world/Tiles';

type State = 'WANDER' | 'CHASE' | 'SEARCH';

export interface CreatureTick {
  caught: boolean;
  dist: number;
  chasing: boolean;
  justSpotted: boolean; // creature began chasing this frame
}

export class Creature {
  state: State = 'WANDER';
  /** scales chase/wander speed (the corridor mode eases this on early floors) */
  speedMul = 1;
  private prevState: State = 'WANDER';
  private currentCell: { cx: number; cz: number };
  private targetCell: { cx: number; cz: number };
  private moveTarget = new THREE.Vector3();
  private lastKnown: { cx: number; cz: number };
  private lastDir: Dir | null = null;
  private bobT = Math.random() * 10;

  constructor(
    readonly spec: CreatureSpec,
    readonly sprite: THREE.Sprite,
    spawnCell: { cx: number; cz: number },
  ) {
    this.currentCell = { ...spawnCell };
    this.targetCell = { ...spawnCell };
    this.lastKnown = { ...spawnCell };
  }

  activate(gen: CorridorGenerator): void {
    const c = gen.cellCenter(this.currentCell.cx, this.currentCell.cz);
    this.sprite.position.set(c.x, 0, c.z);
    this.moveTarget.copy(c);
    this.decideNext(gen, this.currentCell);
  }

  /** Nudge a wandering creature toward a cell so the player actually meets it. */
  directTo(cell: { cx: number; cz: number }): void {
    this.lastKnown = { ...cell };
    if (this.state === 'WANDER') this.state = 'SEARCH';
  }

  update(dt: number, player: THREE.Vector3, gen: CorridorGenerator): CreatureTick {
    const playerCell = gen.worldToCell(player.x, player.z);
    const dx = player.x - this.sprite.position.x;
    const dz = player.z - this.sprite.position.z;
    const dist = Math.hypot(dx, dz);
    const los = dist < this.spec.sight &&
      gen.lineOfSight(this.sprite.position.x, this.sprite.position.z, player.x, player.z);

    if (los) {
      this.state = 'CHASE';
      this.lastKnown = { ...playerCell };
    } else if (this.state === 'CHASE') {
      this.state = 'SEARCH';
    }
    const justSpotted = this.state === 'CHASE' && this.prevState !== 'CHASE';
    this.prevState = this.state;

    const baseSpeed = this.state === 'CHASE'
      ? this.spec.speed
      : this.state === 'SEARCH'
        ? this.spec.speed * 0.7
        : this.spec.wanderSpeed;
    const speed = baseSpeed * this.speedMul;

    // move toward current target cell centre; re-decide at boundaries
    const tx = this.moveTarget.x - this.sprite.position.x;
    const tz = this.moveTarget.z - this.sprite.position.z;
    const td = Math.hypot(tx, tz);
    if (td < 0.14) {
      this.currentCell = { ...this.targetCell };
      this.decideNext(gen, playerCell);
    } else {
      this.sprite.position.x += (tx / td) * speed * dt;
      this.sprite.position.z += (tz / td) * speed * dt;
    }

    this.bobT += dt;
    this.sprite.position.y = this.spec.floaty ? Math.sin(this.bobT * 1.6) * 0.12 + 0.08 : 0;

    return { caught: dist < this.spec.catchRadius, dist, chasing: this.state === 'CHASE', justSpotted };
  }

  private decideNext(gen: CorridorGenerator, playerCell: { cx: number; cz: number }): void {
    let dir: Dir | null = null;
    if (this.state === 'CHASE') {
      dir = gen.greedyStepToward(this.currentCell, playerCell);
    } else if (this.state === 'SEARCH') {
      if (this.currentCell.cx === this.lastKnown.cx && this.currentCell.cz === this.lastKnown.cz) {
        this.state = 'WANDER';
        dir = this.wanderDir(gen);
      } else {
        dir = gen.greedyStepToward(this.currentCell, this.lastKnown);
      }
    } else {
      dir = this.wanderDir(gen);
    }
    if (!dir) dir = this.wanderDir(gen);
    if (!dir) {
      this.targetCell = { ...this.currentCell };
      this.moveTarget.copy(gen.cellCenter(this.currentCell.cx, this.currentCell.cz));
      return;
    }
    this.lastDir = dir;
    const [ddx, ddz] = DELTA[dir];
    this.targetCell = { cx: this.currentCell.cx + ddx, cz: this.currentCell.cz + ddz };
    this.moveTarget.copy(gen.cellCenter(this.targetCell.cx, this.targetCell.cz));
  }

  private wanderDir(gen: CorridorGenerator): Dir | null {
    const opts = gen.openNeighbors(this.currentCell.cx, this.currentCell.cz);
    if (!opts.length) return null;
    const reverse = this.lastDir ? OPPOSITE[this.lastDir] : null;
    const fwd = reverse ? opts.filter((d) => d !== reverse) : opts;
    const pool = fwd.length ? fwd : opts;
    return pool[Math.floor(Math.random() * pool.length)];
  }
}
