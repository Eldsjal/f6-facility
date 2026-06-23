import * as THREE from 'three';
import { Engine } from '../core/Engine';
import { Input } from '../core/Input';
import { AudioManager } from '../audio/AudioManager';
import { RunState } from './RunState';
import { HUD } from '../ui/HUD';
import { Menu } from '../ui/Menu';
import { CreatureManager } from '../creatures/CreatureManager';
import { CorridorMode } from './modes/CorridorMode';
import { LabMode } from './modes/LabMode';

type Mode = 'BOOT' | 'MENU' | 'LAB' | 'CORRIDORS' | 'DEAD';

/** Top-level state machine: owns one active mode at a time and the run loop. */
export class Game {
  private engine: Engine;
  private input = new Input();
  private audio = new AudioManager();
  private runState = new RunState();
  private hud: HUD;
  private menu: Menu;
  private creatures: CreatureManager;
  private corridor: CorridorMode;
  private lab: LabMode;
  private menuScene = new THREE.Scene();
  private mode: Mode = 'BOOT';

  constructor(canvas: HTMLCanvasElement, overlay: HTMLElement) {
    this.engine = new Engine(canvas);
    this.hud = new HUD(overlay);
    this.menu = new Menu(overlay);
    this.creatures = new CreatureManager(this.menuScene);

    this.corridor = new CorridorMode({
      camera: this.engine.camera,
      domElement: this.engine.renderer.domElement,
      input: this.input,
      audio: this.audio,
      runState: this.runState,
      hud: this.hud,
      postFX: this.engine.postFX,
      creatures: this.creatures,
      onDeath: (c) => this.die(c),
      onReturnLab: () => this.enterLab(),
    });

    this.lab = new LabMode(this.engine.camera, overlay, {
      runState: this.runState,
      audio: this.audio,
      punch: (n) => this.engine.postFX.punch(n),
      onEnter: () => this.enterCorridors(),
    });

    // menu / death backdrop
    this.menuScene.background = new THREE.Color(0x05060a);
    this.menuScene.fog = new THREE.FogExp2(0x05060a, 0.1);
    this.menuScene.add(new THREE.AmbientLight(0x223044, 0.3));
    const fl = new THREE.PointLight(0xff2222, 9, 32, 1.3);
    fl.position.set(0, 3, -8);
    this.menuScene.add(fl);

    this.menu.onStart = () => this.startRun();

    // pause handling (pointer-lock exit during corridors)
    this.corridor.player.controls.addEventListener('unlock', () => {
      if (this.mode === 'CORRIDORS') this.hud.showPause();
    });
    this.corridor.player.controls.addEventListener('lock', () => this.hud.hidePause());
    this.hud.onPauseClick(() => {
      if (this.mode === 'CORRIDORS') { this.audio.resume(); this.corridor.player.lock(); }
    });
  }

  async init(): Promise<void> {
    await this.creatures.preload();
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__f6 = {
        engine: this.engine, corridor: this.corridor, run: this.runState,
      };
    }
    this.mode = 'MENU';
    this.menu.showTitle();
    this.hud.hide();
    this.engine.camera.position.set(0, 1.6, 4);
    this.engine.camera.lookAt(0, 1.6, -8);
    this.engine.start((dt) => this.tick(dt));
  }

  private startRun(): void {
    this.audio.resume();
    this.runState.reset();
    this.enterLab();
  }

  private enterLab(): void {
    const fromCorridor = this.mode === 'CORRIDORS';
    this.mode = 'LAB';
    if (fromCorridor) {
      this.corridor.exit();
      this.runState.addSanity(18); // small relief for banking
    }
    this.corridor.player.unlock();
    this.menu.hide();
    this.hud.hide();
    this.hud.hidePause();
    this.audio.resume();
    this.audio.startAmbient();
    this.audio.setAmbientIntensity(0.2);
    this.lab.enter();
  }

  private enterCorridors(): void {
    this.mode = 'CORRIDORS';
    this.lab.exit();
    this.hud.show();
    this.audio.resume();
    this.audio.startAmbient();
    this.corridor.enter();
    this.corridor.player.lock();
  }

  private die(cause: string): void {
    if (this.mode === 'DEAD') return;
    this.mode = 'DEAD';
    const record = this.runState.saveBest();
    this.audio.setThreat(999, false);
    this.audio.stinger('death');
    this.audio.stopAmbient();
    this.hud.flash(0.7);
    this.corridor.player.unlock();
    this.corridor.exit();
    this.hud.hide();
    this.menu.showDeath(this.runState.score, this.runState.bestScore, cause, record);
  }

  private tick(dt: number): void {
    let scene: THREE.Scene;
    if (this.mode === 'CORRIDORS') {
      this.corridor.update(dt);
      scene = this.corridor.scene;
    } else if (this.mode === 'LAB') {
      this.lab.update(dt);
      scene = this.lab.scene;
    } else {
      scene = this.menuScene;
      this.engine.postFX.setVignetteTarget(0.55);
      this.engine.postFX.setGrain(0.08);
    }
    this.audio.update(dt);
    this.engine.postFX.update(dt);
    this.engine.renderScene(scene, dt);
  }
}
