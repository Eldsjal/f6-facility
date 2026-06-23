import * as THREE from 'three';

/** Build a grimy, mottled tiling texture procedurally (no asset files needed). */
function grimeTexture(base: [number, number, number], speckle = 26, blotch = 0.5): THREE.CanvasTexture {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  const [r, g, b] = base;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, S, S);

  // dark blotches / water stains
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const rad = 8 + Math.random() * 60;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const dark = Math.random() * blotch;
    grad.addColorStop(0, `rgba(0,0,0,${dark})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }

  // fine speckle noise
  const img = ctx.getImageData(0, 0, S, S);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * speckle;
    d[i] = THREE.MathUtils.clamp(d[i] + n, 0, 255);
    d[i + 1] = THREE.MathUtils.clamp(d[i + 1] + n, 0, 255);
    d[i + 2] = THREE.MathUtils.clamp(d[i + 2] + n, 0, 255);
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface FacilityMaterials {
  wall: THREE.MeshStandardMaterial;
  floor: THREE.MeshStandardMaterial;
  ceiling: THREE.MeshStandardMaterial;
  light: THREE.MeshStandardMaterial; // emissive fixture (per-cell clones for flicker)
  stair: THREE.MeshStandardMaterial;
  elevator: THREE.MeshStandardMaterial;
  propDark: THREE.MeshStandardMaterial; // pods, slabs, pillars, machines
  propGlass: THREE.MeshStandardMaterial; // emissive containment glass
  dispose(): void;
}

/** Shared materials for the whole facility (one set, reused across all cells). */
export function createMaterials(): FacilityMaterials {
  const wallTex = grimeTexture([58, 64, 56], 22, 0.55);
  wallTex.repeat.set(1, 1);
  const floorTex = grimeTexture([30, 30, 32], 30, 0.7);
  floorTex.repeat.set(2, 2);
  const ceilTex = grimeTexture([22, 22, 24], 18, 0.6);

  const wall = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95, metalness: 0.0 });
  const floor = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 1.0, metalness: 0.0 });
  const ceiling = new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 1.0, metalness: 0.0 });

  const light = new THREE.MeshStandardMaterial({
    color: 0x20210f,
    emissive: 0xfff2cc,
    emissiveIntensity: 2.4,
    toneMapped: false,
  });
  const stair = new THREE.MeshStandardMaterial({
    color: 0x110000, emissive: 0xff2222, emissiveIntensity: 1.6, toneMapped: false,
  });
  const elevator = new THREE.MeshStandardMaterial({
    color: 0x111000, emissive: 0xffb627, emissiveIntensity: 1.4, toneMapped: false,
  });

  const propDark = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.7, metalness: 0.35 });
  const propGlass = new THREE.MeshStandardMaterial({
    color: 0x070d10, emissive: 0x123842, emissiveIntensity: 1.1,
    transparent: true, opacity: 0.55, toneMapped: false,
  });

  return {
    wall, floor, ceiling, light, stair, elevator, propDark, propGlass,
    dispose() {
      [wall, floor, ceiling, light, stair, elevator, propDark, propGlass].forEach((m) => {
        (m.map as THREE.Texture | null)?.dispose();
        m.dispose();
      });
    },
  };
}
