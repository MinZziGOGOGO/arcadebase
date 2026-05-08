// ArcadeBase — Shared game loop, pause, score, and overlay management

const GameBase = {
  create(opts) {
    var self = { opts: opts };

    // Canvas
    var r = Utils.setupCanvas(opts.container, opts.canvasW, opts.canvasH);
    self.canvas = r.canvas; self.ctx = r.ctx;

    // State
    self.state = 'title'; self.score = 0; self.paused = false;
    self.highScore = Utils.loadHighScore(opts.gameKey);
    self._rafId = null; self._lastTime = 0;

    // HUD
    var hud = document.createElement('div'); hud.className = 'hud-bar';
    hud.innerHTML = '<span><label class="score-label">SCORE: </label><span class="score-value" id="score-val">0</span></span>'
      + '<span><label class="score-label">BEST: </label><span class="best-value" id="best-val">'+self.highScore+'</span></span>'
      + '<button class="btn btn-pink" id="pause-btn">∥</button>';
    r.canvas.parentNode.insertAdjacentElement('afterend', hud);
    self._hud = hud;

    // Help button (only if helpText provided)
    if (opts.helpText) {
      var helpBtn = document.createElement('button');
      helpBtn.className = 'help-btn';
      helpBtn.textContent = '?';
      helpBtn.setAttribute('aria-label', 'Help');
      r.canvas.parentNode.appendChild(helpBtn);

      helpBtn.addEventListener('click', function() {
        var popup = document.createElement('div');
        popup.className = 'help-popup';
        popup.innerHTML = '<div class="help-popup-inner">'
          + '<h3>' + (opts.helpTitle || 'HOW TO PLAY') + '</h3>'
          + '<p>' + opts.helpText.replace(/\\n/g, '<br>') + '</p>'
          + '<button class="btn btn-cyan" id="help-close">GOT IT</button>'
          + '</div>';
        document.body.appendChild(popup);
        document.getElementById('help-close').addEventListener('click', function() {
          popup.remove();
        });
        popup.addEventListener('click', function(e) {
          if (e.target === popup) popup.remove();
        });
      });
    }

    // Overlay
    var overlay = document.createElement('div'); overlay.className = 'overlay hidden';
    overlay.innerHTML = '<h2 class="overlay-title" id="ov-title"></h2>'
      + '<div class="overlay-score" id="ov-score"></div>'
      + '<div class="overlay-subtitle" id="ov-sub"></div>'
      + '<button class="btn btn-gold" id="ov-btn">START</button>';
    r.canvas.parentNode.appendChild(overlay);
    self._overlay = overlay;

    // Expose helpers on self
    self.showOverlay = function(title, sub, score, btn) {
      overlay.classList.remove('hidden');
      document.getElementById('ov-title').textContent = title;
      document.getElementById('ov-sub').textContent = sub||'';
      document.getElementById('ov-score').textContent = score?'SCORE: '+score:'';
      document.getElementById('ov-btn').textContent = btn||'START';
    };
    self.hideOverlay = function() { overlay.classList.add('hidden'); };
    self.updateHUD = function() {
      document.getElementById('score-val').textContent = self.score;
      document.getElementById('best-val').textContent = Math.max(self.score, self.highScore);
      document.getElementById('pause-btn').textContent = self.paused ? '\u25B6' : '\u2225';
    };
    self.addScore = function(pts) {
      self.score += pts;
      if (self.score > self.highScore) {
        self.highScore = self.score;
        Utils.saveHighScore(opts.gameKey, self.highScore);
      }
    };
    self.startGame = function() {
      self.score = 0; self.paused = false; self.state = 'playing';
      self.hideOverlay(); self.updateHUD(); self._lastTime = 0;
      if (opts.restart) opts.restart.call(self);
    };
    self.gameOver = function() {
      self.state = 'gameover';
      if (self.score >= self.highScore) { self.highScore = self.score; Utils.saveHighScore(opts.gameKey, self.highScore); }
      self.showOverlay('GAME OVER', 'Tap to restart', self.score, 'RESTART');
    };
    self.togglePause = function() {
      if (self.state==='title'||self.state==='gameover') return;
      self.paused = !self.paused;
      if (self.paused) { self.state = 'paused_overlay'; self.showOverlay('PAUSED','',self.score,'RESUME'); }
      else { self.state = 'playing'; self.hideOverlay(); self._lastTime = 0; }
      self.updateHUD();
    };

    // Button handlers
    document.getElementById('ov-btn').addEventListener('click', function() {
      if (self.state==='title'||self.state==='gameover') self.startGame();
      else if (self.state==='paused_overlay') self.togglePause();
    });
    document.getElementById('pause-btn').addEventListener('click', function() { self.togglePause(); });

    // Keyboard pause
    var keyH = function(e) {
      if ((e.key==='Escape'||e.key==='p'||e.key==='P') && (self.state==='playing'||self.state==='paused_overlay'))
        self.togglePause();
    };
    window.addEventListener('keydown', keyH);
    self._cleanupListener = function() { window.removeEventListener('keydown', keyH); };

    // Init game
    if (opts.init) opts.init.call(self, r.canvas, r.ctx);

    // Game loop
    var loop = function(ts) {
      if (!self._lastTime) self._lastTime = ts;
      self._rafId = requestAnimationFrame(loop);
      var dt = Math.min((ts - self._lastTime)/1000, 0.05);
      self._lastTime = ts;

      if (self.state==='playing' && !self.paused) {
        self.ctx.clearRect(0,0,opts.canvasW,opts.canvasH);
        if (opts.update) opts.update.call(self, dt);
        if (opts.draw) opts.draw.call(self, self.ctx);
        self.updateHUD();
      } else if (self.state==='paused_overlay') {
        self.ctx.clearRect(0,0,opts.canvasW,opts.canvasH);
        if (opts.draw) opts.draw.call(self, self.ctx);
      } else {
        self.ctx.clearRect(0,0,opts.canvasW,opts.canvasH);
        if (opts.draw) opts.draw.call(self, self.ctx);
      }
    };
    self._rafId = requestAnimationFrame(loop);

    // Start
    if (opts.start) opts.start.call(self);

    self.destroy = function() {
      if (self._rafId) cancelAnimationFrame(self._rafId);
      if (self._cleanupListener) self._cleanupListener();
      if (self.canvas && self.canvas._cleanupResize) self.canvas._cleanupResize();
      if (self._hud) self._hud.remove();
      if (self._overlay) self._overlay.remove();
    };

    return self;
  }
};

window.GameBase = GameBase;
