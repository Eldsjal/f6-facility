import * as THREE from 'three';
import { LabUI, type LabContext } from '../../lab/LabUI';

/**
 * Safe mode. A dim containment-room backdrop is rendered through the same
 * post-processing for cohesion, while the actual experiment interface is the
 * DOM console (LabUI) layered on top.
 */
export class LabMode {
  readonly scene = new THREE.Scene();
  private ui: LabUI;
  private t = 0;

  constructor(private camera: THREE.PerspectiveCamera, private overlay: HTMLElement, ctx: LabContext) {
    this.ui = new LabUI(ctx);

    this.scene.background = new THREE.Color(0x05060a);
    this.scene.fog = new THREE.FogExp2(0x05060a, 0.11);
    this.scene.add(new THREE.AmbientLight(0x32506a, 0.5));
    const key = new THREE.PointLight(0xff3322, 14, 34, 1.4);
    key.position.set(2, 3.2, -6);
    this.scene.add(key);

    // emissive bars at the edges to give the bloom something to chew on
    const barGeo = new THREE.PlaneGeometry(0.28, 4.2);
    for (let i = 0; i < 4; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x7a2a12, emissiveIntensity: 2.2, toneMapped: false });
      const bar = new THREE.Mesh(barGeo, mat);
      bar.position.set(-10 + i * 6.5, 2.0, -10);
      this.scene.add(bar);
    }
    // a slab "containment table" silhouette
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(3, 0.4, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 1 }),
    );
    slab.position.set(0, 0.6, -5);
    this.scene.add(slab);
  }

  enter(): void {
    this.ui.mount(this.overlay);
    this.camera.position.set(0, 1.6, 3.4);
    this.camera.lookAt(0, 1.5, -6);
    this.t = 0;
  }

  exit(): void {
    this.ui.unmount();
  }

  update(dt: number): void {
    this.t += dt;
    this.camera.position.x = Math.sin(this.t * 0.25) * 0.28;
    this.camera.position.y = 1.6 + Math.sin(this.t * 0.5) * 0.03;
    this.camera.lookAt(0, 1.5, -6);
  }
}
