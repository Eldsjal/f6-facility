import * as THREE from 'three';
import { CorridorGenerator } from '../../world/CorridorGenerator';
import { createMaterials, type FacilityMaterials } from '../../world/Materials';
import { PlayerController } from '../../player/PlayerController';
import { Flashlight } from '../../player/Flashlight';
import type { CreatureManager } from '../../creatures/CreatureManager';
import type { AudioManager } from '../../audio/AudioManager';
import type { RunState } from '../RunState';
import type { HUD } from '../../ui/HUD';
import type { PostProcessing } from '../../core/PostProcessing';
import type { Input } from '../../core/Input';

export interface CorridorDeps {
  camera: THREE.PerspectiveCamera;
  domElement: HTMLElement;
  input: Input;
  audio: AudioManager;
  runState: RunState;
  hud: HUD;
  postFX: PostProcessing;
  creatures: CreatureManager;
  onDeath: (cause: string) => void;
  onReturnLab: () => void;
}

/** First-person survival mode: the procedurally streamed facility, the player,
 *  the flashlight, the released creatures, and the permadeath pressure loop. */
export class CorridorMode {
  readonly scene = new THREE.Scene();
  readonly gen: CorridorGenerator;
  readonly player: PlayerController;
  private mats: FacilityMaterials;
  private flashlight: Flashlight;
  private ambient = new THREE.AmbientLight(0x223044, 0.12);

  private batteries: { mesh: THREE.Mesh; pos: THREE.Vector3 }[] = [];
  private batteryGeo = new THREE.BoxGeometry(0.22, 0.5, 0.22);
  private batteryMat: THREE.MeshStandardMaterial;

  private t = 0;
  private shake = 0;
  private fading = false;
  private dead = false;

  constructor(private d: CorridorDeps) {
    this.scene.background = new THREE.Color(0x04050a);
    this.scene.fog = new THREE.FogExp2(0x04050a, 0.085);
    this.scene.add(this.ambient);
    this.scene.add(new THREE.HemisphereLight(0x1d2632, 0x05060a, 0.06));

    this.mats = createMaterials();
    this.gen = new CorridorGenerator(this.scene, this.mats);
    this.player = new PlayerController(d.camera, d.domElement, d.input, this.gen);
    this.player.onFootstep = (i) => d.audio.footstep(i);
    this.flashlight = new Flashlight(d.camera);

    this.batteryMat = new THREE.MeshStandardMaterial({
      color: 0x110d00, emissive: 0xffb627, emissiveIntensity: 1.8, toneMapped: false,
    });
  }

  enter(): void {
    this.dead = false;
    this.fading = false;
    this.t = 0;
    this.d.creatures.setScene(this.scene);
    this.scene.add(this.d.camera); // so the flashlight (child of camera) lights the scene
    this.buildFloor();
  }

  exit(): void {
    this.gen.clearAll();
    this.d.creatures.clear();
    this.clearBatteries();
    this.scene.remove(this.d.camera);
  }

  private buildFloor(): void {
    const floorIndex = this.d.runState.depth - 1;
    const size = Math.min(42, 22 + floorIndex * 2);
    const seed = (this.d.runState.seed + this.d.runState.depth * 7919) >>> 0;
    this.gen.generateFloor(seed, size, floorIndex);

    // recolour the wing to this floor's theme
    const th = this.gen.theme;
    (this.scene.background as THREE.Color).setHex(th.fog);
    (this.scene.fog as THREE.FogExp2).color.setHex(th.fog);
    this.ambient.color.setHex(th.ambient);

    const entry = this.gen.cellCenter(this.gen.entry.cx, this.gen.entry.cz);
    this.player.spawnAt(entry);
    (this.scene.fog as THREE.FogExp2).density = this.gen.fogDensity;
    this.gen.update(this.player.camera.position);
    this.spawnCreatures();
    this.spawnBatteries();
  }

  private spawnCreatures(): void {
    const depth = this.d.runState.depth;
    const rel = this.d.runState.released;
    // plenty of encounters (the director also herds them toward you), but slow
    // and escapable early so it's tense, not unfair
    const count = Math.min(12, 3 + (depth - 1) * 2 + Math.max(0, rel.length - 1));
    const speedMul = Math.min(1.18, 0.82 + (depth - 1) * 0.08);
    this.d.creatures.spawn(rel, this.gen, this.player.camera.position, count, speedMul);
  }

  private spawnBatteries(): void {
    this.clearBatteries();
    const pc = this.gen.worldToCell(this.player.camera.position.x, this.player.camera.position.z);
    const n = 4 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const cell = this.gen.randomCellFar(pc, 4);
      const c = this.gen.cellCenter(cell.cx, cell.cz);
      const mesh = new THREE.Mesh(this.batteryGeo, this.batteryMat);
      mesh.position.set(c.x, 0.5, c.z);
      this.scene.add(mesh);
      this.batteries.push({ mesh, pos: new THREE.Vector3(c.x, 0.5, c.z) });
    }
  }

  private clearBatteries(): void {
    for (const b of this.batteries) this.scene.remove(b.mesh);
    this.batteries = [];
  }

  update(dt: number): void {
    this.t += dt;
    if (this.dead) return;
    if (this.fading) { this.gen.updateLights(dt, this.t); return; }
    if (!this.player.locked) return; // paused (pointer unlocked)

    const rs = this.d.runState;
    this.player.update(dt);
    const pos = this.player.camera.position;

    this.gen.update(pos);
    this.gen.updateLights(dt, this.t);

    const threat = this.d.creatures.update(dt, pos, this.gen);
    this.d.audio.setThreat(threat.nearest, threat.chasing);

    // JUMP SCARE: flash + lunge stinger + screen shake + analog tear
    if (threat.jumpscare) {
      this.d.hud.flash(0.85);
      this.d.audio.stinger('jump');
      this.d.postFX.punch(1.4);
      this.shake = 0.45;
    }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const a = this.shake * 0.16;
      pos.x += (Math.random() - 0.5) * a;
      pos.y += (Math.random() - 0.5) * a;
    }

    if (this.d.input.consumePressed('KeyF')) this.flashlight.toggle();
    this.flashlight.update(dt, rs.power, this.t);

    const lightOn = this.flashlight.on && rs.power > 0;
    if (lightOn) rs.drainPower(dt * 1.1);

    // sanity pressure (eased)
    let drain = 0;
    if (!lightOn) drain += 3.5;
    if (threat.chasing) drain += 4;
    if (threat.nearest < 3.5) drain += 3;
    if (drain > 0) rs.drainSanity(dt * drain);
    else rs.addSanity(dt * 2.6);

    // score
    rs.addScore(dt * (2 + rs.depth * 0.6));
    rs.timeAlive += dt;

    // battery pickups
    for (const b of [...this.batteries]) {
      if (b.pos.distanceTo(pos) < 1.3) {
        rs.addPower(55);
        rs.addScore(50);
        this.scene.remove(b.mesh);
        this.batteries = this.batteries.filter((x) => x !== b);
        this.d.audio.footstep(0.5);
      } else {
        b.mesh.rotation.y += dt * 2;
      }
    }

    // the look reacts to sanity / threat
    const sFrac = 1 - rs.sanity / 100;
    this.d.postFX.setVignetteTarget(0.4 + sFrac * 0.5);
    this.d.postFX.setGrain(0.06 + sFrac * 0.07);
    if (threat.chasing && Math.random() < 0.05) this.d.postFX.punch(0.5);
    this.d.audio.setAmbientIntensity(threat.chasing ? 0.95 : 0.28 + sFrac * 0.3);

    // stair / elevator interactions
    const pcell = this.player.cell();
    let prompt = '';
    if (pcell.cx === this.gen.stair.cx && pcell.cz === this.gen.stair.cz) {
      this.descend();
    } else if (pcell.cx === this.gen.elevator.cx && pcell.cz === this.gen.elevator.cz) {
      prompt = 'Press E — return to the Lab (your score is safe)';
      if (this.d.input.consumePressed('KeyE')) { this.d.onReturnLab(); return; }
    }

    this.d.hud.update(rs, prompt, this.gen.theme.name);

    if (threat.caught) { this.die('Something you made caught you in the dark.'); return; }
    if (rs.sanity <= 0) { this.die('Your mind came apart in the corridors.'); return; }
  }

  private descend(): void {
    if (this.fading) return;
    this.fading = true;
    void this.d.hud.transition(() => {
      this.d.runState.depth++;
      this.d.runState.addScore(250);
      this.d.audio.stinger('transform');
      this.buildFloor();
    }).then(() => { this.fading = false; });
  }

  private die(cause: string): void {
    if (this.dead) return;
    this.dead = true;
    this.d.onDeath(cause);
  }
}
