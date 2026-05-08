// SNAKE — ArcadeBase

(function () {
  var GRID = 20;
  var BASE_INTERVAL = 150;
  var SPEED_STEP = 2;
  var MIN_INTERVAL = 60;

  var DIRS = {
    up:    { dx:  0, dy: -1 },
    down:  { dx:  0, dy:  1 },
    left:  { dx: -1, dy:  0 },
    right: { dx:  1, dy:  0 },
  };

  var game = GameBase.create({
    container: document.getElementById('canvas-wrapper'),
    canvasW: 400,
    canvasH: 400,
    gameKey: 'snake',
    helpText: 'Eat food to grow longer\\nDon\'t hit walls or yourself\\nSpeed increases with every meal\\nScore: 10 pts per food eaten',
    helpTitle: 'SNAKE RULES',

    init: function(canvas, ctx) {
      var self = this;

      this.cellSize  = canvas.width / GRID;
      this.body      = [];
      this.direction = null;
      this.nextDir   = null;
      this.food      = null;
      this.stepTimer = 0;
      this.stepInterval = BASE_INTERVAL;
      this.foodEaten    = 0;

      // Attach helpers to self so they resolve in callbacks
      this._queueDir = function(dirName) {
        var tgt = DIRS[dirName];
        if (!tgt) return;
        var cur = self.nextDir ? self.nextDir : self.direction;
        if (!cur) { self.nextDir = tgt; return; }
        if (cur.dx + tgt.dx === 0 && cur.dy + tgt.dy === 0) return;
        self.nextDir = tgt;
      };

      this._spawnFood = function() {
        var avail = [];
        for (var x=0; x<GRID; x++)
          for (var y=0; y<GRID; y++)
            if (!self.body.some(function(s) { return s.x===x && s.y===y; }))
              avail.push({x:x, y:y});
        if (avail.length===0) { self.gameOver(); return; }
        self.food = avail[Math.floor(Math.random()*avail.length)];
      };

      // Swipe
      Utils.createSwipeDetector(canvas, {
        onSwipe: function(dir) { if (self.state==='playing'&&!self.paused) self._queueDir(dir); },
      });

      // D-pad
      [['dpad-up','up'],['dpad-down','down'],['dpad-left','left'],['dpad-right','right']]
        .forEach(function(pair) {
          var btn = document.getElementById(pair[0]);
          if (!btn) return;
          (function(dir) {
            function handler(e) { e.preventDefault(); if (self.state==='playing'&&!self.paused) self._queueDir(dir); }
            btn.addEventListener('click', handler);
            btn.addEventListener('touchstart', handler, { passive: false });
          })(pair[1]);
        });

      // Keyboard
      var km = { ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right', w:'up',s:'down',a:'left',d:'right' };
      this._keyHandler = function(e) {
        var d = km[e.key];
        if (d && self.state==='playing' && !self.paused) { e.preventDefault(); self._queueDir(d); }
      };
      window.addEventListener('keydown', this._keyHandler);
    },

    start: function() {
      this.state = 'title';
      this._overlay.classList.remove('hidden');
      this._overlay.querySelector('#ov-title').textContent = 'SNAKE';
      this._overlay.querySelector('#ov-sub').textContent   = 'Swipe or use D-Pad';
      this._overlay.querySelector('#ov-score').textContent = '';
      this._overlay.querySelector('#ov-btn').textContent   = 'START';
    },

    restart: function() {
      var cx = 10, cy = 10; // center of 20x20 grid
      this.body = [{x:cx,y:cy},{x:cx-1,y:cy},{x:cx-2,y:cy}];
      this.direction    = DIRS.right;
      this.nextDir      = null;
      this.foodEaten    = 0;
      this.stepInterval = BASE_INTERVAL;
      this.stepTimer    = 0;
      this._spawnFood();
    },

    update: function(dt) {
      this.stepTimer += dt * 1000;
      if (this.stepTimer < this.stepInterval) return;
      this.stepTimer = Math.min(this.stepTimer - this.stepInterval, this.stepInterval);

      if (this.nextDir) { this.direction = this.nextDir; this.nextDir = null; }

      var head = this.body[0];
      var nh   = { x: head.x+this.direction.dx, y: head.y+this.direction.dy };

      if (nh.x<0||nh.x>=GRID||nh.y<0||nh.y>=GRID) { /* wall */ this.gameOver(); return; }

      for (var i=0; i<this.body.length-1; i++)
        if (this.body[i].x===nh.x && this.body[i].y===nh.y) { /* self */ this.gameOver(); return; }

      this.body.unshift(nh);

      if (this.food && nh.x===this.food.x && nh.y===this.food.y) {
        this.addScore(10);
        this.foodEaten++;
        this.stepInterval = Math.max(MIN_INTERVAL, BASE_INTERVAL - this.foodEaten*SPEED_STEP);
        this._spawnFood();
      } else {
        this.body.pop();
      }
    },

    draw: function(ctx) {
      var cs = this.cellSize;
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      ctx.strokeStyle = '#111122';
      ctx.lineWidth = 1;
      for (var i=0; i<=GRID; i++) {
        ctx.beginPath(); ctx.moveTo(i*cs,0); ctx.lineTo(i*cs,this.canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,i*cs); ctx.lineTo(this.canvas.width,i*cs); ctx.stroke();
      }

      if (this.food) {
        ctx.fillStyle = '#ff006e';
        var fx=this.food.x*cs, fy=this.food.y*cs, p=3;
        ctx.fillRect(fx+p,fy+p,cs-p*2,cs-p*2);
      }

      if (!this.body||!this.body.length) return;

      for (var i=this.body.length-1; i>=0; i--) {
        var s=this.body[i], sx=s.x*cs, sy=s.y*cs, p=1;
        if (i===0) {
          ctx.fillStyle = '#39ff14';
          ctx.fillRect(sx+p,sy+p,cs-p*2,cs-p*2);
          ctx.fillStyle = '#0a0a0a';
          var es=4, eo=5, d=this.direction;
          if (d && d.dx===1)      { ctx.fillRect(sx+cs-eo-es,sy+eo,es,es); ctx.fillRect(sx+cs-eo-es,sy+cs-eo-es,es,es); }
          else if (d && d.dx===-1){ ctx.fillRect(sx+eo,sy+eo,es,es); ctx.fillRect(sx+eo,sy+cs-eo-es,es,es); }
          else if (d && d.dy===-1){ ctx.fillRect(sx+eo,sy+eo,es,es); ctx.fillRect(sx+cs-eo-es,sy+eo,es,es); }
          else if (d)             { ctx.fillRect(sx+eo,sy+cs-eo-es,es,es); ctx.fillRect(sx+cs-eo-es,sy+cs-eo-es,es,es); }
        } else {
          ctx.fillStyle = '#00cc22';
          ctx.fillRect(sx+p,sy+p,cs-p*2,cs-p*2);
        }
      }
    },
  });
})();
