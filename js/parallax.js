/* ============================================================
   parallax.js — 2.5D depth for the home scene (req: bruno-simon
   style "3D feel", done cheaply + mobile-friendly).

   Splits the painterly scene into depth layers (.plx[data-depth])
   plus the pet and chick, and shifts each by a parallax factor
   driven by:
     - device tilt (gyroscope; iOS asks permission on first tap)
     - finger drag / mouse move (works everywhere, no permission)
   A requestAnimationFrame loop lerps toward the target offset so
   motion is smooth, not jumpy. Pure CSS transforms = GPU-composited,
   no battery/heat cost of real WebGL.

   Respects prefers-reduced-motion (skips entirely).
   ============================================================ */
(function () {
  let layers = [];        // [{el, depth}]
  let tx = 0, ty = 0;     // current (lerped) offset -1..1
  let targetX = 0, targetY = 0;
  let running = false;
  let bound = false;
  let gyroAsked = false;
  const MAX = 22;         // px of travel at depth 1.0

  const reduced = typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  // collect the layers present in the current DOM
  function collect() {
    layers = [];
    const plx = document.querySelectorAll('.scene-wrap .plx');
    plx.forEach(el => layers.push({ el, depth: parseFloat(el.getAttribute('data-depth')) || 0.5 }));
    const pet = document.getElementById('petAvatar');
    if (pet) layers.push({ el: pet, depth: 1.15, keepCenter: true });
    const chick = document.getElementById('sceneChick');
    if (chick) layers.push({ el: chick, depth: 1.5 });
  }

  function apply() {
    for (const L of layers) {
      const dx = -tx * MAX * L.depth;
      const dy = -ty * MAX * L.depth * 0.6;
      // pet/chick already have their own positioning transforms in CSS;
      // we add parallax via a CSS variable the stylesheet composes with.
      if (L.el.classList.contains('scene-pet') || L.el.classList.contains('scene-chick')) {
        L.el.style.setProperty('--plx-x', dx.toFixed(1) + 'px');
        L.el.style.setProperty('--plx-y', dy.toFixed(1) + 'px');
      } else {
        L.el.setAttribute('transform', `translate(${dx.toFixed(1)} ${dy.toFixed(1)})`);
      }
    }
  }

  function loop() {
    if (!running) return;
    // lerp toward target
    tx += (targetX - tx) * 0.08;
    ty += (targetY - ty) * 0.08;
    apply();
    if (Math.abs(targetX - tx) > 0.001 || Math.abs(targetY - ty) > 0.001) {
      requestAnimationFrame(loop);
    } else {
      running = false;
    }
  }
  function kick() { if (!running) { running = true; requestAnimationFrame(loop); } }

  function setTarget(x, y) {
    targetX = Math.max(-1, Math.min(1, x));
    targetY = Math.max(-1, Math.min(1, y));
    kick();
  }

  // ---- inputs ----
  function onPointer(e) {
    const t = e.touches ? e.touches[0] : e;
    if (!t) return;
    const w = window.innerWidth || 380, h = window.innerHeight || 640;
    setTarget((t.clientX / w) * 2 - 1, (t.clientY / h) * 2 - 1);
  }
  function onOrient(e) {
    // gamma: left/right tilt (-90..90), beta: front/back (-180..180)
    if (e.gamma == null) return;
    setTarget(Math.max(-1, Math.min(1, e.gamma / 35)), Math.max(-1, Math.min(1, (e.beta - 45) / 45)));
  }

  function bindInputs() {
    if (bound || reduced) return;
    bound = true;
    window.addEventListener('mousemove', onPointer, { passive: true });
    window.addEventListener('touchmove', onPointer, { passive: true });
    // gyro: needs a user gesture + permission on iOS 13+
    const enableGyro = () => {
      if (gyroAsked) return; gyroAsked = true;
      const DOE = window.DeviceOrientationEvent;
      if (DOE && typeof DOE.requestPermission === 'function') {
        DOE.requestPermission().then(s => {
          if (s === 'granted') window.addEventListener('deviceorientation', onOrient, { passive: true });
        }).catch(() => {});
      } else if (DOE) {
        window.addEventListener('deviceorientation', onOrient, { passive: true });
      }
    };
    window.addEventListener('touchstart', enableGyro, { once: true, passive: true });
    window.addEventListener('click', enableGyro, { once: true });
  }

  // called by UI after the home scene renders
  function attach() {
    if (reduced) return;
    collect();
    if (!layers.length) return;
    bindInputs();
    // settle to neutral
    targetX = 0; targetY = 0; kick();
  }

  window.Parallax = { attach, _setTarget: setTarget };
})();
