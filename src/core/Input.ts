// Centralised keyboard state + a shared single-vs-double click helper used by
// the lab console (single = select, double = commit).

export class Input {
  private readonly keys = new Set<string>();
  /** edge-triggered keys consumed via consumePressed() */
  private readonly pressed = new Set<string>();

  constructor() {
    window.addEventListener('keydown', (e) => {
      // Ignore auto-repeat for edge events.
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  /** True once per physical key press; clears after read. */
  consumePressed(code: string): boolean {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  /** Movement axis from WASD / arrows. x = strafe (+right), z = forward (+ahead). */
  moveAxis(): { x: number; z: number } {
    let x = 0;
    let z = 0;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) z += 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) z -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    return { x, z };
  }

  sprinting(): boolean {
    return this.isDown('ShiftLeft') || this.isDown('ShiftRight');
  }
}

/**
 * Attach single/double-click discrimination to a DOM element.
 * A lone click resolves as `onSingle` after `delay` ms; a second click inside
 * the window cancels that and fires `onDouble` (the experiment commit).
 */
export function attachClickDual(
  el: HTMLElement,
  onSingle: () => void,
  onDouble: () => void,
  delay = 250,
): void {
  let timer: number | null = null;
  el.addEventListener('click', () => {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
      onDouble();
    } else {
      timer = window.setTimeout(() => {
        timer = null;
        onSingle();
      }, delay);
    }
  });
}
