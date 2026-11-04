// The phone's back in 2.5D: the card tilts toward the pointer (a slow sway where there is none), a band of light
// slides across the case as it does, and the stars turn holographic with the angle. The depth is a stack of thin
// layers between the two faces (scripts/journey-page.mjs). The tilt settles as the phone turns over.
const phoneTilt = (() => {
  let tx = 0, ty = 0, gx = 0, gy = 0, hasPointer = false;
  addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; hasPointer = true; gx = (e.clientY / innerHeight - 0.5) * -14; gy = (e.clientX / innerWidth - 0.5) * 22; }, { passive: true });
  // from the frame loop: how far into the prologue; gives the tilt in degrees and sets where the light falls
  return function tilt(ip) {
    if (reduce || ip >= 0.3) return { x: 0, y: 0 };
    if (!hasPointer) { gx = Math.sin(T * 0.6) * 5; gy = Math.sin(T * 0.43) * 9; }
    tx += (gx - tx) * 0.08; ty += (gy - ty) * 0.08;
    const k = 1 - ease(ip / 0.12), x = tx * k, y = ty * k;
    phone.style.setProperty('--lx', `${(50 - y * 3.2).toFixed(1)}%`);
    phone.style.setProperty('--ly', `${(50 + x * 3.2).toFixed(1)}%`);
    return { x, y };
  };
})();
