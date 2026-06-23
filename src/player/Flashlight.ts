import * as THREE from 'three';

/**
 * A single SpotLight rig parented to the camera so it always points where the
 * player looks. Battery (`power`) drives brightness; low power makes it stutter.
 */
export class Flashlight {
  readonly light: THREE.SpotLight;
  private readonly target: THREE.Object3D;
  on = true;
  private baseIntensity = 75;

  constructor(private camera: THREE.PerspectiveCamera) {
    this.light = new THREE.SpotLight(0xfff1d6, this.baseIntensity, 26, Math.PI / 5.0, 0.45, 1.0);
    this.light.position.set(0, 0, 0.2);
    this.target = new THREE.Object3D();
    this.target.position.set(0, -0.05, -1);
    camera.add(this.light);
    camera.add(this.target);
    this.light.target = this.target;
  }

  toggle(): void { this.on = !this.on; }

  update(_dt: number, power: number, t: number): void {
    if (!this.on || power <= 0) {
      this.light.intensity = 0;
      return;
    }
    let mult = 1;
    if (power < 18) {
      // dying-battery stutter
      mult = Math.sin(t * 22) > 0.2 ? 1 : 0.25;
      if (Math.random() < 0.04) mult = 0;
    }
    this.light.intensity = this.baseIntensity * mult;
  }
}
