import * as THREE from 'three';
import { CREATURES, ALL_IDS, type CreatureId } from './CreatureSpec';
import { makeBillboard } from './Billboard';
import { creatureBillboard, type Billboard } from './CreatureArt';
import { Creature } from './Creature';
import type { CorridorGenerator } from '../world/CorridorGenerator';

export interface ThreatState {
  caught: boolean;
  nearest: number;
  chasing: boolean;
  jumpscare: boolean; // a creature just lunged into view / got right behind you
}

/** Spawns and updates the creatures the player released from the lab. */
export class CreatureManager {
  private textures = new Map<CreatureId, Billboard>();
  private creatures: Creature[] = [];
  private scareCooldown = 0;
  private directorTimer = 5;

  constructor(private scene: THREE.Scene) {}

  /** Draw every creature into a billboard texture once, up front. */
  async preload(): Promise<void> {
    for (const id of ALL_IDS) {
      try {
        this.textures.set(id, creatureBillboard(id));
      } catch (e) {
        console.warn('[F6] creature art failed', id, e);
      }
    }
  }

  setScene(scene: THREE.Scene): void { this.scene = scene; }

  spawn(
    ids: CreatureId[],
    gen: CorridorGenerator,
    playerPos: THREE.Vector3,
    count: number,
    speedMul = 1,
  ): void {
    this.clear();
    if (!ids.length) return;
    const playerCell = gen.worldToCell(playerPos.x, playerPos.z);
    for (let i = 0; i < count; i++) {
      const id = ids[Math.floor(Math.random() * ids.length)];
      const bb = this.textures.get(id);
      if (!bb) continue;
      const spec = CREATURES[id];
      const cell = gen.randomCellFar(playerCell, 5);
      const sprite = makeBillboard(bb.texture, bb.aspect, spec.height);
      const cre = new Creature(spec, sprite, cell);
      cre.speedMul = speedMul;
      this.scene.add(sprite);
      cre.activate(gen);
      this.creatures.push(cre);
    }
  }

  update(dt: number, playerPos: THREE.Vector3, gen: CorridorGenerator): ThreatState {
    this.scareCooldown = Math.max(0, this.scareCooldown - dt);
    this.directorTimer -= dt;
    let nearest = Infinity;
    let chasing = false;
    let caught = false;
    let jumpscare = false;
    let nearestIdle: Creature | null = null;
    let nearestIdleDist = Infinity;
    for (const c of this.creatures) {
      const t = c.update(dt, playerPos, gen);
      if (t.caught) caught = true;
      if (t.dist < nearest) nearest = t.dist;
      if (t.chasing) chasing = true;
      if (!t.chasing && t.dist < nearestIdleDist) { nearestIdleDist = t.dist; nearestIdle = c; }
      // a creature snapping to CHASE while close enough to see = a scare
      if (t.justSpotted && t.dist < 12 && this.scareCooldown <= 0) jumpscare = true;
    }
    // "it's right behind you" surprise
    if (!jumpscare && chasing && nearest < 2.6 && this.scareCooldown <= 0) jumpscare = true;
    if (jumpscare) this.scareCooldown = 3.0;

    // DIRECTOR: during a lull, send the nearest idle creature your way so the
    // facility never feels empty — you will be found.
    if (this.directorTimer <= 0) {
      this.directorTimer = 7 + Math.random() * 3;
      if (!chasing && nearestIdle) {
        nearestIdle.directTo(gen.worldToCell(playerPos.x, playerPos.z));
      }
    }
    return { caught, nearest, chasing, jumpscare };
  }

  clear(): void {
    for (const c of this.creatures) {
      this.scene.remove(c.sprite);
      (c.sprite.material as THREE.SpriteMaterial).dispose();
    }
    this.creatures = [];
    this.scareCooldown = 0;
    this.directorTimer = 5;
  }

  get count(): number { return this.creatures.length; }
}
