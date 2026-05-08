// ArcadeBase — Shared Utilities

const Utils = {
  loadHighScore(gameKey) {
    try { const v = localStorage.getItem(gameKey); return v ? parseInt(v, 10) : 0; }
    catch(e) { return 0; }
  },

  saveHighScore(gameKey, score) {
    try {
      const cur = Utils.loadHighScore(gameKey);
      if (score > cur) { localStorage.setItem(gameKey, String(score)); return true; }
    } catch(e) {}
    return false;
  },

  setupCanvas(container, logicalW, logicalH) {
    const wrapper = document.createElement('div');
    wrapper.className = 'canvas-wrapper';
    const canvas = document.createElement('canvas');
    canvas.className = 'game-canvas';
    canvas.width = logicalW; canvas.height = logicalH;
    canvas.style.width = logicalW+'px'; canvas.style.height = logicalH+'px';
    wrapper.appendChild(canvas); container.appendChild(wrapper);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const resize = () => {
      const maxW = window.innerWidth - 16;
      const maxH = window.innerHeight - 160;
      const scale = Math.min(maxW/logicalW, maxH/logicalH, 1.0);
      canvas.style.width = Math.floor(logicalW*scale)+'px';
      canvas.style.height = Math.floor(logicalH*scale)+'px';
    };
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 100));
    resize();
    canvas._cleanupResize = () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
    };
    return { canvas, ctx };
  },

  createSwipeDetector(el, opts) {
    if (typeof opts === 'number') opts = { threshold: opts };
    opts = opts || {};
    const threshold = opts.threshold || 30;
    const maxTime = opts.maxTime || 300;
    let _onSwipe = null;
    const _condition = opts.condition || (function() { return true; });
    let startX=0, startY=0, startTime=0, moved=false;

    const onStart = (e) => {
      if (!_condition()) return;  // allow page scroll when game inactive
      e.preventDefault();
      const t = e.touches ? e.touches[0] : e;
      startX=t.clientX; startY=t.clientY; startTime=Date.now(); moved=false;
    };
    const onMove = (e) => {
      const t = e.touches ? e.touches[0] : e;
      if (Math.abs(t.clientX-startX)>5 || Math.abs(t.clientY-startY)>5) moved = true;
    };
    const onEnd = (e) => {
      if (!_onSwipe) return;
      if (!_condition()) return;  // ignore swipes when inactive
      const t = e.changedTouches ? e.changedTouches[0] : e;
      const dx=t.clientX-startX, dy=t.clientY-startY;
      const dist=Math.sqrt(dx*dx+dy*dy), dt=Date.now()-startTime;
      if (dist<threshold && dt<maxTime && !moved) { e.preventDefault(); _onSwipe('tap'); return; }
      if (dist<threshold || dt>maxTime) return;
      e.preventDefault();
      const a = Math.atan2(-dy,dx)*180/Math.PI;
      let dir;
      if (a>-45 && a<=45) dir='right';
      else if (a>45 && a<=135) dir='up';
      else if (a>135 || a<=-135) dir='left';
      else dir='down';
      _onSwipe(dir);
    };
    el.addEventListener('touchstart', onStart, {passive:false});
    el.addEventListener('touchmove', onMove, {passive:false});
    el.addEventListener('touchend', onEnd, {passive:false});
    el.addEventListener('mousedown', onStart);
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseup', onEnd);
    return {
      onSwipe(fn) { _onSwipe = fn; },
      destroy() {
        el.removeEventListener('touchstart',onStart);
        el.removeEventListener('touchmove',onMove);
        el.removeEventListener('touchend',onEnd);
        el.removeEventListener('mousedown',onStart);
        el.removeEventListener('mousemove',onMove);
        el.removeEventListener('mouseup',onEnd);
      }
    };
  },

  clamp(val, min, max) {
    if (val < min) return min;
    if (val > max) return max;
    return val;
  },

  rand(min, max) {
    return min + Math.random() * (max - min);
  },

  getCanvasPos(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width/rect.width, sy = canvas.height/rect.height;
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    if (cx==null) return null;
    return { x: (cx-rect.left)*sx, y: (cy-rect.top)*sy };
  }
};
