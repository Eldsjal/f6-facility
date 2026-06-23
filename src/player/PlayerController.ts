import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import type { Input } from '../core/Input';
import type { CorridorGenerator } from '../world/CorridorGenerator';
import { resolveCollision } from '../world/Collision';
import { EYE } from '../world/Tiles';

const WALK = 3.1;
const SPRINT = 5.0;
const RADIUS = 0.42;
const STEP_LEN = 2.0;

export class PlayerController {
  readonly controls: PointerLockControls;
  /** fires on each footstep; intensity 0..1 reflects speed (for creature hearing) */
  onFootstep: ((intensity: number) => void) | null = null;

  private fwd = new THREE.Vector3();
  private right = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private stepAccum = 0;
  private bobPhase = 0;
  private moving = false;

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    private input: Input,
    private gen: CorridorGenerator,
  ) {
    this.controls = new PointerLockControls(camera, domElement);
  }

  get locked(): boolean { return this.controls.isLocked; }
  lock(): void { this.controls.lock(); }
  unlock(): void { this.controls.unlock(); }

  spawnAt(pos: THREE.Vector3): void {
    this.camera.position.set(pos.x, EYE, pos.z);
  }

  /** Is the player physically standing on this cell? */
  cell(): { cx: number; cz: number } {
    return this.gen.worldToCell(this.camera.position.x, this.camera.position.z);
  }

  update(dt: number): void {
    if (!this.controls.isLocked) { this.moving = false; return; }

    const axis = this.input.moveAxis();
    const sprint = this.input.sprinting() && axis.z > 0;
    const speed = sprint ? SPRINT : WALK;

    this.camera.getWorldDirection(this.fwd);
    this.fwd.y = 0;
    this.fwd.normalize();
    this.right.crossVectors(this.fwd, this.up).normalize();

    const len = Math.hypot(axis.x, axis.z);
    this.moving = len > 0.01;

    if (this.moving) {
      const inv = 1 / len;
      const dx = (this.fwd.x * axis.z + this.right.x * axis.x) * inv * speed * dt;
      const dz = (this.fwd.z * axis.z + this.right.z * axis.x) * inv * speed * dt;
      this.camera.position.x += dx;
      this.camera.position.z += dz;
      resolveCollision(this.gen, this.camera.position, RADIUS);

      // footsteps + headbob accumulate with distance travelled
      const dist = Math.hypot(dx, dz);
      this.stepAccum += dist;
      this.bobPhase += dist * 3.1;
      if (this.stepAccum >= STEP_LEN) {
        this.stepAccum -= STEP_LEN;
        this.onFootstep?.(sprint ? 1 : 0.6);
      }
    }

    const bob = this.moving ? Math.sin(this.bobPhase) * 0.05 : 0;
    this.camera.position.y = EYE + bob;
  }
}
