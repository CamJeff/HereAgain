/* animation.js
   Drop-in replacement: subtle "breeze" motion around grid intersections + mouse repulsion.
   Targets <canvas id="dot-sea"> inside .hero.full-height.
*/

class DotGrid {
  constructor(containerId = "dot-sea", options = {}) {
    this.canvasElement = document.getElementById(containerId);
    if (!this.canvasElement) {
      // If there's no canvas, fail silently.
      return;
    }

    // default options (tweak breezeAmp and breezeSpeed for softer/harder motion)
    this.options = Object.assign({
      gridSize: 42,           // matches your background grid density
      dotRadius: 1.15,
      color: "rgba(255, 255, 255, 0.78)",
      influence: 1.05,        // mouse repulsion strength
      mouseFalloff: 145,     // px distance where mouse influence decays
      breezeAmp: 3.2,        // maximum px offset from intersection (soft — small value)
      breezeSpeed: 0.0008,   // global multiplier for breeze frequency (very small => slow)
      breezeJitter: 0.25     // small randomness multiplier for each dot's speed
    }, options);

    // canvas context
    this.ctx = this.canvasElement.getContext("2d");
    // logical device pixel ratio handling
    this.dpr = window.devicePixelRatio || 1;

    // internal state
    this.dots = [];            // each dot: {baseX, baseY, x, y, phaseX, phaseY, speed}
    this.mouse = { x: -9999, y: -9999, active: false };
    this._raf = null;
    this._lastTime = performance.now();

    // bound methods
    this._draw = this._draw.bind(this);
    this._resize = this._resize.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseLeave = this._onMouseLeave.bind(this);

    // initialize
  }

  init() {
    this._resize();
    // events
    window.addEventListener("resize", this._resize, { passive: true });

    // attach mouse events to the hero container (so mouse coords are relative)
    const hero = this.canvasElement.closest(".hero") || document.body;
    hero.addEventListener("mousemove", this._onMouseMove, { passive: true });
    hero.addEventListener("mouseleave", this._onMouseLeave, { passive: true });

    // start loop
    this._lastTime = performance.now();
    this._raf = window.requestAnimationFrame(this._draw);
  }

  _resize() {
    // Fit canvas to its container (.hero.full-height); use bounding rect for precise size
    const rect = this.canvasElement.getBoundingClientRect();
    const w = Math.max(0 | rect.width, 1);
    const h = Math.max(0 | rect.height, 1);

    // handle device pixel ratio
    this.dpr = window.devicePixelRatio || 1;
    this.canvasElement.width = Math.round(w * this.dpr);
    this.canvasElement.height = Math.round(h * this.dpr);
    this.canvasElement.style.width = w + "px";
    this.canvasElement.style.height = h + "px";
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // rebuild grid of dots
    this._buildGrid(w, h);
  }

  _buildGrid(width, height) {
    const gs = this.options.gridSize;
    const r = this.options.dotRadius;

    this.dots = [];

    // We'll center the grid so intersections line up with background grid.
    // Find starting offset so that grid lines align with the container left/top.
    // We'll create intersections across the entire hero area.
    const cols = Math.ceil(width / gs) + 1;
    const rows = Math.ceil(height / gs) + 1;

    // compute top-left offset that aligns intersections to multiples of gs (keeps consistent with background)
    const offsetX = -(Math.floor((width % gs) / 2));
    const offsetY = -(Math.floor((height % gs) / 2));

    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const baseX = i * gs + offsetX;
        const baseY = j * gs + offsetY;

        // small random phases so motion is varied
        const phaseX = Math.random() * Math.PI * 2;
        const phaseY = Math.random() * Math.PI * 2;
        // per-dot speed multiplier (close to 1 but with tiny jitter)
        const speed = 1 + (Math.random() - 0.5) * this.options.breezeJitter;

        this.dots.push({
          baseX,
          baseY,
          x: baseX,
          y: baseY,
          phaseX,
          phaseY,
          speed
        });
      }
    }
  }

  _onMouseMove(e) {
    const rect = this.canvasElement.getBoundingClientRect();
    // coordinates relative to canvas element (CSS pixels)
    this.mouse.x = e.clientX - rect.left;
    this.mouse.y = e.clientY - rect.top;
    this.mouse.active = true;
  }

  _onMouseLeave() {
    // When mouse leaves hero, treat as inactive
    this.mouse.active = false;
    // move mouse far away so repulsion drops off naturally
    this.mouse.x = -9999;
    this.mouse.y = -9999;
  }

  _draw(now) {
    const ctx = this.ctx;
    const opts = this.options;
    const dt = now - this._lastTime;
    this._lastTime = now;

    // clear canvas
    ctx.clearRect(0, 0, this.canvasElement.width / this.dpr, this.canvasElement.height / this.dpr);

    // time in ms
    const t = now;

    // for each dot, compute breeze offset and mouse repulsion, then draw
    for (let i = 0; i < this.dots.length; i++) {
      const d = this.dots[i];

      // breeze: very slow sinusoidal movement around base position
      // combine two oscillators (sin and cos) with different phases and dot-specific speed
      const breezeFreq = opts.breezeSpeed * d.speed;
      const ax = Math.sin(t * breezeFreq + d.phaseX) * opts.breezeAmp;
      const ay = Math.cos(t * breezeFreq * 1.12 + d.phaseY) * (opts.breezeAmp * 0.85);

      // target position = base + breeze
      const targetX = d.baseX + ax;
      const targetY = d.baseY + ay;

      // mouse repulsion: if mouse active and within falloff range, push away
      let repX = 0, repY = 0;
      if (this.mouse.active) {
        const dx = d.baseX - this.mouse.x;
        const dy = d.baseY - this.mouse.y;
        const distSq = dx * dx + dy * dy;
        const falloff = opts.mouseFalloff;
        if (distSq < (falloff * falloff)) {
          const dist = Math.sqrt(distSq) || 0.0001;
          // normalized direction from mouse to dot
          const nx = dx / dist;
          const ny = dy / dist;

          // influence factor scales from 1 at mouse to 0 at falloff radius
          const influence = (1 - (dist / falloff)) ** 2.6; // smoother falloff

          // repulsion magnitude
          const mag = opts.influence * 2.35 * influence * Math.min(falloff, 75);

          repX = nx * mag;
          repY = ny * mag;
        }
      }

      // final target includes repulsion
      const finalTargetX = targetX + repX;
      const finalTargetY = targetY + repY;

      // smooth the movement: lerp current position toward final target (smoothing factor small -> soft motion)
      const lerpFactor = 0.12; // smaller value => softer smoothing
      d.x += (finalTargetX - d.x) * lerpFactor;
      d.y += (finalTargetY - d.y) * lerpFactor;

      // draw the dot
      ctx.beginPath();
      ctx.arc(d.x, d.y, opts.dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = opts.color;
      ctx.fill();
    }

    // schedule next frame
    this._raf = window.requestAnimationFrame(this._draw);
  }
}

// Initialize grid on DOMContentLoaded in case script is included in head
(function() {
  function start() {
    const grid = new DotGrid("dot-sea");
    if (grid && grid.init) grid.init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();