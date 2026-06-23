import * as THREE from 'three';
import { PostProcessing } from './PostProcessing';

/**
 * Renderer + camera + post-processing + the animation loop. Scene-agnostic:
 * each game mode owns its own THREE.Scene and hands it to `renderScene`.
 */
export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  readonly postFX: PostProcessing;
  private readonly clock = new THREE.Clock();
  private placeholder = new THREE.Scene();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false, // crunchy PSX edges + cheaper
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.05,
      120,
    );

    this.postFX = new PostProcessing(this.renderer, this.placeholder, this.camera);

    window.addEventListener('resize', () => this.onResize());
  }

  private onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.postFX.setSize(w, h);
  }

  start(tick: (dt: number) => void): void {
    this.renderer.setAnimationLoop(() => {
      const dt = Math.min(this.clock.getDelta(), 0.05); // clamp huge frames
      tick(dt);
    });
  }

  renderScene(scene: THREE.Scene, dt: number): void {
    this.postFX.render(scene, this.camera, dt);
  }
}
