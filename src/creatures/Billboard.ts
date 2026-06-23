import * as THREE from 'three';

/**
 * A camera-facing sprite anchored by its feet. The texture is the keyed
 * creature cutout; lighting is ignored (sprites are unlit) so pale faces read
 * in the dark while the fog attenuates them with distance.
 */
export function makeBillboard(texture: THREE.Texture, aspect: number, height: number): THREE.Sprite {
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.45,
    depthWrite: true,
    fog: true,
    color: 0xffffff,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.center.set(0.5, 0.0); // anchor at bottom-centre (feet)
  sprite.scale.set(height * aspect, height, 1);
  return sprite;
}
