// Keyboard + mouse input. Keys are tracked by code; `pressed` is true only
// on the update that first sees the key down, and it is cleared per UPDATE
// (not per render frame) so a slow frame that runs two fixed steps can never
// consume one press twice — the double-toggle that bit CANTING's pause.
export function createInput() {
  const down = new Set();
  const pressed = new Set();
  let mouse = { x: 0, y: 0, clicked: false, down: false };

  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!down.has(event.code)) pressed.add(event.code);
    down.add(event.code);
  }
  function onKeyUp(event) {
    down.delete(event.code);
  }
  function onMouseMove(event) {
    mouse = { ...mouse, x: event.clientX, y: event.clientY };
  }
  function onMouseDown(event) {
    mouse = { ...mouse, x: event.clientX, y: event.clientY, down: true, clicked: true };
  }
  function onMouseUp() {
    mouse = { ...mouse, down: false };
  }

  return {
    attach(target) {
      target.addEventListener('keydown', onKeyDown);
      target.addEventListener('keyup', onKeyUp);
      target.addEventListener('mousemove', onMouseMove);
      target.addEventListener('mousedown', onMouseDown);
      target.addEventListener('mouseup', onMouseUp);
    },
    detach(target) {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('mousemove', onMouseMove);
      target.removeEventListener('mousedown', onMouseDown);
      target.removeEventListener('mouseup', onMouseUp);
    },
    isDown(code) {
      return down.has(code);
    },
    /** True once, on the first update after the key went down. */
    wasPressed(code) {
      return pressed.has(code);
    },
    /** Axes from WASD or arrows: -1, 0 or 1 each. */
    axes() {
      const x = (this.isDown('KeyD') || this.isDown('ArrowRight') ? 1 : 0)
        - (this.isDown('KeyA') || this.isDown('ArrowLeft') ? 1 : 0);
      const y = (this.isDown('KeyS') || this.isDown('ArrowDown') ? 1 : 0)
        - (this.isDown('KeyW') || this.isDown('ArrowUp') ? 1 : 0);
      return { x, y };
    },
    interactHeld() {
      return this.isDown('KeyE') || this.isDown('Space') || mouse.down;
    },
    interactPressed() {
      return this.wasPressed('KeyE') || this.wasPressed('Space') || mouse.clicked;
    },
    mousePos() {
      return { x: mouse.x, y: mouse.y };
    },
    /** Clear per-update presses. Call once after every world.update(). */
    endFrame() {
      pressed.clear();
      mouse.clicked = false;
    },
    /** Test hook: pretend a key was pressed, without a DOM event. */
    fakePress(code) {
      if (!down.has(code)) pressed.add(code);
      down.add(code);
    },
    fakeRelease(code) {
      down.delete(code);
    },
    fakeMouse(x, y, clicked) {
      mouse = { x, y, down: !!clicked, clicked: !!clicked };
    },
  };
}
