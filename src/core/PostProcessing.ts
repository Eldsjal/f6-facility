import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const VHS_FRAGMENT = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform float time;
  uniform float aberration;
  uniform float grain;
  uniform float scanline;
  uniform float vignette;
  uniform float flicker;
  uniform float glitch;
  uniform float desat;
  varying vec2 vUv;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }

  void main(){
    vec2 uv = vUv;

    // line jitter / tearing, scaled by glitch
    float lineNoise = hash(vec2(floor(uv.y * 120.0), floor(time * 15.0)));
    uv.x += (lineNoise - 0.5) * glitch * 0.06;
    float roll = step(0.995, hash(vec2(floor(time * 3.0), 7.0))) * glitch;
    uv.y = fract(uv.y + roll * 0.02);

    // chromatic aberration, stronger toward the edges
    vec2 center = uv - 0.5;
    float edge = dot(center, center);
    float ca = aberration * (0.0025 + edge * 0.02) + glitch * 0.012;
    vec3 col;
    col.r = texture2D(tDiffuse, uv + vec2(ca, 0.0)).r;
    col.g = texture2D(tDiffuse, uv).g;
    col.b = texture2D(tDiffuse, uv - vec2(ca, 0.0)).b;

    // sickly desaturation
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, vec3(l) * vec3(0.92, 1.03, 0.94), desat);

    // scanlines
    float s = sin(uv.y * 800.0) * 0.5 + 0.5;
    col *= 1.0 - scanline * (1.0 - s);

    // film grain
    float g = hash(uv * vec2(1920.0, 1080.0) + time);
    col += (g - 0.5) * grain;

    // global flicker (multiplier driven by game state)
    col *= flicker;

    // vignette
    float v = smoothstep(0.85, 0.18, length(center));
    col *= mix(1.0, v, vignette);

    gl_FragColor = vec4(max(col, 0.0), 1.0);
  }
`;

const VHS_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Owns the EffectComposer. The "look" is a fear instrument: vignette, grain,
 * aberration, scanlines and flicker are all driven from game state each frame.
 */
export class PostProcessing {
  readonly composer: EffectComposer;
  private readonly renderPass: RenderPass;
  private readonly bloom: UnrealBloomPass;
  private readonly vhs: ShaderPass;

  private time = 0;
  private glitchEnergy = 0;
  private baseGrain = 0.07;
  private baseFlicker = 1.0;
  private targetVignette = 0.55;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    const size = renderer.getSize(new THREE.Vector2());

    this.composer = new EffectComposer(renderer);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    this.bloom = new UnrealBloomPass(size.clone(), 0.55, 0.7, 0.82);
    this.composer.addPass(this.bloom);

    this.vhs = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        time: { value: 0 },
        aberration: { value: 1.0 },
        grain: { value: this.baseGrain },
        scanline: { value: 0.22 },
        vignette: { value: this.targetVignette },
        flicker: { value: 1.0 },
        glitch: { value: 0.0 },
        desat: { value: 0.55 },
      },
      vertexShader: VHS_VERTEX,
      fragmentShader: VHS_FRAGMENT,
    });
    this.composer.addPass(this.vhs);

    this.composer.addPass(new OutputPass());
  }

  setSize(w: number, h: number): void {
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
  }

  /** Burst of analog distortion — used on stingers / transformations. */
  punch(amount = 1): void {
    this.glitchEnergy = Math.min(1.4, this.glitchEnergy + amount);
  }

  setVignetteTarget(v: number): void {
    this.targetVignette = THREE.MathUtils.clamp(v, 0, 1);
  }

  setGrain(g: number): void {
    this.baseGrain = g;
  }

  /** Base brightness multiplier (1 = normal). Lighting flicker layers on top. */
  setFlickerBase(f: number): void {
    this.baseFlicker = f;
  }

  update(dt: number): void {
    this.time += dt;
    this.glitchEnergy = Math.max(0, this.glitchEnergy - dt * 1.6);

    const u = this.vhs.uniforms;
    u.time.value = this.time;
    u.glitch.value = this.glitchEnergy;
    u.grain.value = this.baseGrain + this.glitchEnergy * 0.06;
    u.aberration.value = 1.0 + this.glitchEnergy * 2.5;

    // ease vignette toward target
    u.vignette.value += (this.targetVignette - u.vignette.value) * Math.min(1, dt * 4);

    // subtle fluorescent flutter, plus any base dimming
    const flutter = 1 - (Math.random() < 0.04 ? Math.random() * 0.35 : 0);
    u.flicker.value = this.baseFlicker * flutter;
  }

  render(scene: THREE.Scene, camera: THREE.Camera, dt: number): void {
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    this.composer.render(dt);
  }

  dispose(): void {
    this.composer.dispose();
  }
}
