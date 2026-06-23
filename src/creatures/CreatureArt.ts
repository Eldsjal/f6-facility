import * as THREE from 'three';
import type { CreatureId } from './CreatureSpec';

// Original, procedurally-drawn creatures *inspired by* the reference imagery —
// not the photos themselves. Each is drawn at a `horror` level (0 = an almost
// ordinary, calm subject; 1 = the fully-realised monster), which lets the lab
// show a subject mutating stage by stage from the same generator.

const W = 384;
const H = 512;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rgb = (r: number, g: number, b: number, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;

export function creatureCanvas(id: CreatureId, horror: number, scale = 1): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W * scale;
  c.height = H * scale;
  const ctx = c.getContext('2d')!;
  ctx.scale(scale, scale);
  const h = Math.max(0, Math.min(1, horror));
  ctx.clearRect(0, 0, W, H);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  DRAW[id](ctx, h);
  grain(ctx, h);
  return c;
}

export interface Billboard {
  texture: THREE.CanvasTexture;
  aspect: number;
}

export function creatureBillboard(id: CreatureId): Billboard {
  const canvas = creatureCanvas(id, 1, 1);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return { texture, aspect: W / H };
}

export function creatureThumb(id: CreatureId): string {
  return creatureCanvas(id, 1, 0.5).toDataURL();
}

// ----------------------------------------------------------- shared helpers
function fleshHead(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, h: number): void {
  const g = ctx.createRadialGradient(cx, cy - ry * 0.2, rx * 0.2, cx, cy, ry * 1.1);
  g.addColorStop(0, rgb(lerp(214, 196, h), lerp(200, 178, h), lerp(186, 168, h)));
  g.addColorStop(0.7, rgb(150, 134, 122));
  g.addColorStop(1, rgb(lerp(70, 40, h), lerp(60, 30, h), lerp(54, 28, h)));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drip(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, w: number, col: string): void {
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + (Math.random() - 0.5) * w, y + len);
  ctx.stroke();
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(x, y + len, w * 0.8, w * 1.2, 0, 0, Math.PI * 2);
  ctx.fill();
}

function grain(ctx: CanvasRenderingContext2D, h: number): void {
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const amt = 16 + h * 14;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 8) continue;
    const n = (Math.random() - 0.5) * amt;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

// ----------------------------------------------------------- the five creatures
const DRAW: Record<CreatureId, (ctx: CanvasRenderingContext2D, h: number) => void> = {
  // F6-01 — pale, hollow-eyed, weeping face over a dark hunched body
  weeper(ctx, h) {
    // body
    ctx.fillStyle = rgb(14, 12, 14);
    ctx.beginPath();
    ctx.moveTo(192, 250);
    ctx.bezierCurveTo(70, 280, 70, 520, 120, 512);
    ctx.lineTo(264, 512);
    ctx.bezierCurveTo(314, 520, 314, 280, 192, 250);
    ctx.fill();

    fleshHead(ctx, 192, 150, 78, 104, h);

    // forehead crack
    ctx.strokeStyle = rgb(40, 20, 22, lerp(0.2, 0.9, h));
    ctx.lineWidth = lerp(1, 3, h);
    ctx.beginPath();
    ctx.moveTo(192, 60); ctx.lineTo(190, 120); ctx.lineTo(194, 175);
    ctx.stroke();

    // hollow eyes
    for (const ex of [165, 219]) {
      const g = ctx.createRadialGradient(ex, 150, 2, ex, 150, 40);
      g.addColorStop(0, rgb(0, 0, 0));
      g.addColorStop(1, rgb(lerp(60, 10, h), lerp(40, 4, h), lerp(40, 6, h), 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(ex, 150, lerp(16, 22, h), lerp(30, 42, h), 0, 0, Math.PI * 2);
      ctx.fill();
      if (h > 0.35) for (let k = 0; k < 2 + (h * 3 | 0); k++) {
        drip(ctx, ex + (Math.random() - 0.5) * 16, 178, 20 + Math.random() * 60 * h, 2.2, rgb(110, 6, 10, 0.85));
      }
    }
    // nose hint
    ctx.fillStyle = rgb(60, 48, 44, 0.6);
    ctx.beginPath(); ctx.ellipse(192, 196, 6, 12, 0, 0, Math.PI * 2); ctx.fill();
    // mouth — closed line, opening to a bleeding gash with horror
    ctx.strokeStyle = rgb(40, 18, 18, 0.8);
    ctx.lineWidth = lerp(2, 5, h);
    ctx.beginPath();
    ctx.moveTo(192, 214);
    ctx.lineTo(192, lerp(228, 250, h));
    ctx.stroke();
    if (h > 0.4) drip(ctx, 192, 250, 30 * h, 3, rgb(120, 6, 10, 0.9));
  },

  // F6-02 — elongated screamer whose arms fork into pale branches
  brancher(ctx, h) {
    const neckLen = lerp(40, 90, h);
    // torso
    const bg = ctx.createLinearGradient(192, 120, 192, 512);
    bg.addColorStop(0, rgb(225, 222, 214));
    bg.addColorStop(1, rgb(120, 116, 110));
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(168, 150 + neckLen);
    ctx.bezierCurveTo(120, 320, 150, 512, 192, 512);
    ctx.bezierCurveTo(234, 512, 264, 320, 216, 150 + neckLen);
    ctx.fill();

    // long neck
    ctx.fillStyle = rgb(220, 216, 208);
    ctx.fillRect(182, 110, 20, 50 + neckLen);

    // head tilted up
    fleshHead(ctx, 192, 96, 40, 50, h * 0.5);
    // screaming mouth
    ctx.fillStyle = rgb(8, 4, 6);
    ctx.beginPath();
    ctx.ellipse(192, 104, lerp(8, 16, h), lerp(10, 30, h), 0, 0, Math.PI * 2);
    ctx.fill();
    // eyes
    ctx.fillStyle = rgb(10, 6, 8);
    ctx.beginPath(); ctx.ellipse(180, 80, 4, 6, 0, 0, Math.PI * 2); ctx.ellipse(204, 80, 4, 6, 0, 0, Math.PI * 2); ctx.fill();
    // chest seam
    ctx.strokeStyle = rgb(120, 10, 14, lerp(0.2, 0.85, h));
    ctx.lineWidth = lerp(1, 3, h);
    ctx.beginPath(); ctx.moveTo(192, 150 + neckLen); ctx.lineTo(192, 430); ctx.stroke();

    // branching arms
    const depth = 1 + Math.round(h * 3);
    ctx.strokeStyle = rgb(222, 218, 210);
    const branch = (x: number, y: number, ang: number, len: number, d: number) => {
      const ex = x + Math.cos(ang) * len;
      const ey = y + Math.sin(ang) * len;
      ctx.lineWidth = Math.max(1, d * 1.6);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
      if (d <= 0) return;
      const spread = lerp(0.25, 0.6, h);
      branch(ex, ey, ang - spread, len * 0.7, d - 1);
      branch(ex, ey, ang + spread, len * 0.7, d - 1);
      if (h > 0.6 && d > 1) branch(ex, ey, ang + (Math.random() - 0.5), len * 0.55, d - 1);
    };
    branch(176, 190, Math.PI * 0.95, lerp(40, 80, h), depth);
    branch(208, 190, Math.PI * 0.05, lerp(40, 80, h), depth);
  },

  // F6-03 — inverted pale face with a long, dripping, striated maw
  hangman(ctx, h) {
    // hanging strand
    ctx.strokeStyle = rgb(30, 28, 30); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(192, 0); ctx.lineTo(192, 60); ctx.stroke();
    // inverted dome head at top
    fleshHead(ctx, 192, 150, 86, 96, h);
    ctx.fillStyle = rgb(8, 6, 8); // cap shadow (top = crown, inverted)
    ctx.beginPath(); ctx.ellipse(192, 80, 86, 50, 0, Math.PI, Math.PI * 2); ctx.fill();
    // round staring eyes (inverted face: eyes lower)
    for (const ex of [160, 224]) {
      ctx.fillStyle = rgb(230, 226, 220);
      ctx.beginPath(); ctx.ellipse(ex, 150, lerp(15, 20, h), lerp(15, 22, h), 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgb(10, 8, 10);
      ctx.beginPath(); ctx.ellipse(ex, 152, lerp(8, 6, h), lerp(8, 9, h), 0, 0, Math.PI * 2); ctx.fill();
    }
    // long striated dripping maw downward
    const maw = lerp(90, 320, h);
    const top = 196;
    ctx.fillStyle = rgb(120, 90, 84);
    ctx.beginPath();
    ctx.moveTo(150, top);
    ctx.lineTo(234, top);
    ctx.lineTo(210, top + maw);
    ctx.lineTo(174, top + maw);
    ctx.fill();
    // vertical teeth/strands
    const n = 6 + Math.round(h * 10);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = lerp(154, 230, t);
      ctx.strokeStyle = i % 2 ? rgb(210, 200, 192, 0.9) : rgb(60, 30, 30, 0.9);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, top + 6); ctx.lineTo(lerp(178, 206, t), top + maw); ctx.stroke();
    }
    if (h > 0.4) for (let k = 0; k < 3 + (h * 4 | 0); k++) {
      drip(ctx, lerp(178, 206, Math.random()), top + maw, 8 + Math.random() * 30, 2.5, rgb(110, 6, 10, 0.85));
    }
  },

  // F6-04 — black, spindly, cone-headed thing on long broken legs
  spindler(ctx, h) {
    const ink = rgb(28, 30, 36);
    // legs
    ctx.strokeStyle = ink;
    const pairs = 2 + Math.round(h * 3);
    const bodyX = 196, bodyY = 300;
    for (let i = 0; i < pairs; i++) {
      for (const dir of [-1, 1]) {
        const reach = lerp(60, 150, h) + i * 18;
        const midX = bodyX + dir * reach * 0.6;
        const midY = bodyY - lerp(20, 90, h) + i * 6;
        const footX = bodyX + dir * reach;
        ctx.lineWidth = lerp(7, 4, h);
        ctx.beginPath();
        ctx.moveTo(bodyX, bodyY);
        ctx.lineTo(midX, midY);
        ctx.lineTo(footX, 500 - i * 4);
        ctx.stroke();
      }
    }
    // hunched body
    ctx.fillStyle = ink;
    ctx.beginPath(); ctx.ellipse(bodyX, bodyY, lerp(70, 48, h), lerp(50, 70, h), 0, 0, Math.PI * 2); ctx.fill();
    // thin neck + cone head pointing up
    ctx.lineWidth = lerp(16, 9, h); ctx.strokeStyle = ink;
    ctx.beginPath(); ctx.moveTo(bodyX, bodyY - 30); ctx.lineTo(170, 150); ctx.stroke();
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(150, 170);
    ctx.lineTo(176, lerp(110, 60, h)); // tip
    ctx.lineTo(196, 168);
    ctx.fill();
    // pale eye holes on the cone
    ctx.fillStyle = rgb(lerp(120, 220, h), lerp(120, 210, h), lerp(110, 200, h));
    ctx.beginPath(); ctx.ellipse(165, 150, 5, 9, 0, 0, Math.PI * 2); ctx.ellipse(182, 150, 5, 9, 0, 0, Math.PI * 2); ctx.fill();
  },

  // F6-05 — robed figure crowned by a radiant single-eyed starburst
  witness(ctx, h) {
    // robe
    const rg = ctx.createLinearGradient(192, 200, 192, 512);
    rg.addColorStop(0, rgb(18, 18, 22));
    rg.addColorStop(1, rgb(4, 4, 6));
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(192, 200);
    ctx.lineTo(120, 512);
    ctx.lineTo(264, 512);
    ctx.fill();

    // starburst
    const cx = 192, cy = 150;
    const rays = 9;
    const inner = lerp(26, 40, h);
    const outer = lerp(48, 100, h);
    ctx.fillStyle = rgb(250, 248, 232);
    ctx.beginPath();
    for (let i = 0; i < rays * 2; i++) {
      const r = i % 2 ? inner : outer * (0.8 + Math.random() * 0.4 * h);
      const a = (i / (rays * 2)) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    // the eye
    ctx.fillStyle = rgb(245, 240, 230);
    ctx.beginPath(); ctx.ellipse(cx, cy, lerp(16, 22, h), lerp(12, 16, h), 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rgb(70, 110, 150);
    ctx.beginPath(); ctx.ellipse(cx + lerp(0, 4, h), cy, lerp(8, 11, h), lerp(8, 11, h), 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rgb(6, 6, 8);
    ctx.beginPath(); ctx.ellipse(cx + lerp(0, 4, h), cy, lerp(3, 6, h), lerp(3, 6, h), 0, 0, Math.PI * 2); ctx.fill();
    if (h > 0.5) { // bloodshot
      ctx.strokeStyle = rgb(150, 20, 20, 0.7); ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const a = Math.random() * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * 12, cy + Math.sin(a) * 9);
        ctx.lineTo(cx + Math.cos(a) * 20, cy + Math.sin(a) * 14);
        ctx.stroke();
      }
    }
  },
};
