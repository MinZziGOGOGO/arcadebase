// TETRIS — ArcadeBase
// Fully playable mobile Tetris: SRS rotation, ghost piece, touch + keyboard controls

(function() {
  var COLS = 10, ROWS = 20, CELL = 30, CW = 300, CH = 600;

  var PIECES = {
    I: { shape: [[0,0],[0,1],[0,2],[0,3]], color: '#00f0ff' },
    O: { shape: [[0,0],[0,1],[1,0],[1,1]], color: '#ffbe0b' },
    T: { shape: [[0,1],[1,0],[1,1],[1,2]], color: '#8338ec' },
    S: { shape: [[0,1],[0,2],[1,0],[1,1]], color: '#39ff14' },
    Z: { shape: [[0,0],[0,1],[1,1],[1,2]], color: '#ff006e' },
    J: { shape: [[0,0],[1,0],[1,1],[1,2]], color: '#3a86ff' },
    L: { shape: [[0,2],[1,0],[1,1],[1,2]], color: '#ff8800' }
  };
  var KEYS = ['I','O','T','S','Z','J','L'];

  // 7-bag randomizer
  var bag = [];
  function nextType() {
    if (bag.length === 0) {
      bag = KEYS.slice();
      for (var i = bag.length-1; i > 0; i--) {
        var j = Math.floor(Math.random()*(i+1));
        var t = bag[i]; bag[i] = bag[j]; bag[j] = t;
      }
    }
    return bag.pop();
  }

  // Rotation
  function rotCW(shape) {
    var maxR = 0;
    for (var i = 0; i < shape.length; i++) { if (shape[i][0] > maxR) maxR = shape[i][0]; }
    return shape.map(function(p) { return [p[1], maxR - p[0]]; });
  }

  // Scoring
  var LINE_PTS = [0, 100, 300, 500, 800];
  function dropInt(level) { return Math.max(0.10, 1.0 - (level-1)*0.075); }

  GameBase.create({
    container: document.getElementById('game-container'),
    canvasW: CW, canvasH: CH,
    gameKey: 'arcadebase_tetris',
    helpText: 'Lines: 1=100, 2=300, 3=500, 4=800\\nHard drop: +2pts per row\\nExtra 400 for back-to-back Tetrises\\nLevel up every 10 lines',
    helpTitle: 'TETRIS RULES',

    init: function(canvas, ctx) {
      var self = this;
      self.board = []; self.current = null; self.nextType = null;
      self.linesClear = 0; self.level = 1; self.dropTimer = 0; self.backToBack = false;

      // Level in HUD
      var lvlSpan = document.createElement('span');
      lvlSpan.id = 'lvl-disp';
      lvlSpan.style.cssText = 'color:#00f0ff;font-size:10px;flex-shrink:0';
      lvlSpan.textContent = 'LVL:1';
      var pauseBtn = this._hud.querySelector('#pause-btn');
      this._hud.insertBefore(lvlSpan, pauseBtn);

      // On-screen controls
      var btnRow = document.createElement('div');
      btnRow.className = 'touch-controls';
      btnRow.innerHTML =
        '<button class="btn btn-cyan" id="bn-l">&larr;</button>' +
        '<button class="btn btn-cyan" id="bn-d">&darr;</button>' +
        '<button class="btn btn-cyan" id="bn-r">&rarr;</button>' +
        '<button class="btn btn-pink" id="bn-rot">&#8631;</button>';
      this._hud.insertAdjacentElement('afterend', btnRow);

      function bind(id, fn) {
        var b = document.getElementById(id);
        b.addEventListener('touchstart', function(e){e.preventDefault();fn.call(self);});
        b.addEventListener('mousedown', function(e){e.preventDefault();fn.call(self);});
      }
      bind('bn-l', self._moveLeft);
      bind('bn-d', self._hardDrop);
      bind('bn-r', self._moveRight);
      bind('bn-rot', self._rotate);

      // Keyboard game input
      this._keyHandler = function(e) {
        if (self.state !== 'playing' || self.paused) return;
        switch (e.key) {
          case 'ArrowLeft': e.preventDefault(); self._moveLeft(); break;
          case 'ArrowRight': e.preventDefault(); self._moveRight(); break;
          case 'ArrowDown': e.preventDefault(); self._moveDown(); break;
          case 'ArrowUp': case 'x': case 'X': e.preventDefault(); self._rotate(); break;
          case ' ': e.preventDefault(); self._hardDrop(); break;
        }
      };
      window.addEventListener('keydown', this._keyHandler);

      // Touch swipe
      this._swiper = Utils.createSwipeDetector(canvas, 25);
      this._swiper.onSwipe(function(dir) {
        if (self.state !== 'playing' || self.paused) return;
        switch (dir) {
          case 'left': self._moveLeft(); break;
          case 'right': self._moveRight(); break;
          case 'down': self._hardDrop(); break;
          case 'tap': self._rotate(); break;
        }
      });
    },

    start: function() {
      this.showOverlay('TETRIS', this.highScore > 0 ? 'Best: ' + this.highScore : 'Classic block puzzle', null, 'START');
    },

    restart: function() {
      this.board = [];
      for (var r = 0; r < ROWS; r++) this.board.push(new Array(COLS).fill(null));
      this.linesClear = 0; this.level = 1; this.dropTimer = 0; this.backToBack = false;
      this.nextType = nextType();
      this._spawn();
    },

    update: function(dt) {
      if (this.state !== 'playing' || this.paused || !this.current) return;
      this.dropTimer += dt;
      if (this.dropTimer >= dropInt(this.level)) {
        this.dropTimer -= dropInt(this.level);
        this._moveDown();
      }
    },

    draw: function(ctx) {
      ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0,0,CW,CH);

      // Grid
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 0.5;
      for (var r = 0; r <= ROWS; r++) { ctx.beginPath(); ctx.moveTo(0,r*CELL); ctx.lineTo(COLS*CELL,r*CELL); ctx.stroke(); }
      for (var c = 0; c <= COLS; c++) { ctx.beginPath(); ctx.moveTo(c*CELL,0); ctx.lineTo(c*CELL,ROWS*CELL); ctx.stroke(); }

      // Locked cells
      for (var r = 0; r < ROWS; r++)
        for (var c = 0; c < COLS; c++)
          if (this.board[r][c]) this._drawCell(ctx, c, r, this.board[r][c], 1);

      // Active piece + ghost
      if (this.current && this.state === 'playing') {
        var gr = this._ghostRow();
        for (var i = 0; i < this.current.shape.length; i++) {
          var rr = gr + this.current.shape[i][0];
          if (rr >= 0) this._drawCell(ctx, this.current.col + this.current.shape[i][1], rr, PIECES[this.current.type].color, 0.2);
        }
        for (var i = 0; i < this.current.shape.length; i++) {
          var rr = this.current.row + this.current.shape[i][0];
          if (rr >= 0) this._drawCell(ctx, this.current.col + this.current.shape[i][1], rr, PIECES[this.current.type].color, 1);
        }
      }

      // Next piece preview
      if (this.nextType) this._drawNext(ctx);
    },

    _drawCell: function(ctx, c, r, color, alpha) {
      var x = c*CELL, y = r*CELL, p = 1, s = CELL-2*p;
      ctx.globalAlpha = alpha; ctx.fillStyle = color;
      ctx.fillRect(x+p, y+p, s, s);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x+p, y+p, s, 3); ctx.fillRect(x+p, y+p, 3, s);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x+p, y+CELL-p-3, s, 3); ctx.fillRect(x+CELL-p-3, y+p, 3, s);
      ctx.globalAlpha = 1;
    },

    _drawNext: function(ctx) {
      var bx=222, by=8, bw=70, bh=70;
      ctx.fillStyle='rgba(10,10,10,0.85)'; ctx.fillRect(bx,by,bw,bh);
      ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=1; ctx.strokeRect(bx,by,bw,bh);
      ctx.fillStyle='#888'; ctx.textAlign='center'; ctx.fillText('NEXT', bx+bw/2, by+14);

      var sh = PIECES[this.nextType].shape, col = PIECES[this.nextType].color;
      var minR=99,maxR=-1,minC=99,maxC=-1;
      for (var i=0;i<sh.length;i++) { var rr=sh[i][0],cc=sh[i][1]; if(rr<minR)minR=rr;if(rr>maxR)maxR=rr;if(cc<minC)minC=cc;if(cc>maxC)maxC=cc; }
      var pw=(maxC-minC+1)*12, ph=(maxR-minR+1)*12;
      var ox=bx+(bw-pw)/2-minC*12, oy=by+22+(bh-30-ph)/2-minR*12;
      ctx.fillStyle=col;
      for (var i=0;i<sh.length;i++) ctx.fillRect(ox+sh[i][1]*12, oy+sh[i][0]*12, 10, 10);
      ctx.textAlign='start';
    },

    _collides: function(shape, row, col) {
      for (var i = 0; i < shape.length; i++) {
        var r = row + shape[i][0], c = col + shape[i][1];
        if (c < 0 || c >= COLS || r >= ROWS) return true;
        if (r >= 0 && this.board[r][c] !== null) return true;
      }
      return false;
    },

    _spawn: function() {
      var type = this.nextType;
      this.nextType = nextType();
      var shape = PIECES[type].shape.map(function(p){return p.slice()});
      var col = 3, row = (type === 'I') ? -1 : 0;
      if (this._collides(shape, row, col)) { this.gameOver(); return; }
      this.current = { type: type, shape: shape, row: row, col: col };
      this.dropTimer = 0;
    },

    _moveDown: function() {
      if (!this.current) return;
      if (this._collides(this.current.shape, this.current.row + 1, this.current.col))
        this._lock();
      else
        { this.current.row++; this.dropTimer = 0; }
    },

    _moveLeft: function() {
      if (this.current && !this._collides(this.current.shape, this.current.row, this.current.col - 1))
        this.current.col--;
    },

    _moveRight: function() {
      if (this.current && !this._collides(this.current.shape, this.current.row, this.current.col + 1))
        this.current.col++;
    },

    _ghostRow: function() {
      var r = this.current.row;
      while (!this._collides(this.current.shape, r + 1, this.current.col)) r++;
      return r;
    },

    _hardDrop: function() {
      if (!this.current) return;
      var dist = this._ghostRow() - this.current.row;
      this.current.row = this._ghostRow();
      if (dist > 0) this.addScore(dist * 2);
      this._lock();
    },

    _rotate: function() {
      if (!this.current || this.current.type === 'O') return;
      var ns = rotCW(this.current.shape);
      var kicks = [0, -1, 1, -2, 2];
      for (var i = 0; i < kicks.length; i++) {
        if (!this._collides(ns, this.current.row, this.current.col + kicks[i])) {
          this.current.shape = ns; this.current.col += kicks[i]; return;
        }
      }
    },

    _lock: function() {
      var c = this.current;
      for (var i = 0; i < c.shape.length; i++) {
        var r = c.row + c.shape[i][0], cc = c.col + c.shape[i][1];
        if (r < 0) { this.current = null; this.gameOver(); return; }
        this.board[r][cc] = PIECES[c.type].color;
      }
      this.current = null;

      // Clear lines
      var cleared = 0;
      for (var r = ROWS - 1; r >= 0; r--) {
        if (this.board[r].every(function(x){return x!==null})) {
          this.board.splice(r, 1);
          this.board.unshift(new Array(COLS).fill(null));
          cleared++; r++;
        }
      }

      if (cleared > 0) {
        this.linesClear += cleared;
        this.level = Math.floor(this.linesClear / 10) + 1;
        document.getElementById('lvl-disp').textContent = 'LVL:' + this.level;
        var pts = LINE_PTS[cleared] || 0;
        if (cleared === 4 && this.backToBack) pts += 400;
        this.backToBack = (cleared === 4);
        this.addScore(pts);
      }

      this._spawn();
    },

    destroy: function() {
      if (this._keyHandler) window.removeEventListener('keydown', this._keyHandler);
      if (this._swiper) this._swiper.destroy();
      if (this._rafId) cancelAnimationFrame(this._rafId);
      if (this._cleanupListener) this._cleanupListener();
      if (this.canvas && this.canvas._cleanupResize) this.canvas._cleanupResize();
      if (this._hud) this._hud.remove();
      if (this._overlay) this._overlay.remove();
    }
  });
})();
