// PAC-MAN — ArcadeBase
// 400×440 canvas, 15×15 tile maze, 4 ghosts with AI, swipe controls

(function() {
  var TILE = 28;
  var GRID = 15;
  var OFFSET_X = 10;
  var OFFSET_Y = 10;
  var PAC_R = 12;
  var PAC_SPEED = 120;
  var GHOST_R = 11;
  var GHOST_SPEED = 100;
  var GHOST_FRIGHT_SPEED = 60;
  var DOT_PTS = 10;
  var PELLET_PTS = 50;
  var FRIGHTEN_TIME = 8;
  var EXTRA_LIFE_SCORE = 10000;
  var MODE_TIMES = [7, 20, 7, 20, 5, 5];

  var mazeLayout = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,2,1,1,1,2,1,1,1,2,2,1],
    [1,2,1,1,2,1,1,1,2,1,1,1,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,2,1,1,2,1,1,2,1,1,2,2,1],
    [1,2,1,2,1,1,2,1,1,2,1,1,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,2,1,1,2,1,1,2,1,1,2,1],
    [1,2,1,1,2,1,1,2,1,1,2,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,2,1,1,2,1,1,2,1,1,2,2,1],
    [1,2,1,2,1,1,2,1,1,2,1,1,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ];

  // Power pellets at corners: (1,1), (1,13), (13,1), (13,13)
  var pelletPositions = [[1,1],[1,13],[13,1],[13,13]];

  var DOT_COLORS = ['#ffbe0b', '#ffbe0b80'];

  function tileCenter(tx, ty) {
    return { x: OFFSET_X + tx * TILE + TILE / 2, y: OFFSET_Y + ty * TILE + TILE / 2 };
  }

  function isWall(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= GRID || ty >= GRID) return true;
    return mazeLayout[ty][tx] === 1;
  }

  function isIntersection(tx, ty) {
    var dirs = [[0,-1],[0,1],[-1,0],[1,0]];
    var openCount = 0;
    for (var d = 0; d < 4; d++) {
      if (!isWall(tx + dirs[d][0], ty + dirs[d][1])) openCount++;
    }
    return openCount > 2 || (openCount === 2 && !(
      (!isWall(tx-1,ty) && !isWall(tx+1,ty) && isWall(tx,ty-1) && isWall(tx,ty+1)) ||
      (!isWall(tx,ty-1) && !isWall(tx,ty+1) && isWall(tx-1,ty) && isWall(tx+1,ty))
    ));
  }

  var game = GameBase.create({
    container: document.getElementById('canvas-wrapper'),
    canvasW: 400,
    canvasH: 440,
    gameKey: 'pacman',
    helpText: 'Swipe to move Pac-Man\\nEat all dots to clear the maze\\nPower pellets let you eat ghosts\\nGhosts use unique chase patterns',
    helpTitle: 'PAC-MAN RULES',

    init: function(canvas, ctx) {
      var self = this;
      self._nextDir = null;
      self._modeTimer = 0;
      self._modeIdx = 0;
      self._extraLifeGiven = false;
      self._tileDots = [];

      // Swipe detector
      self._swipe = Utils.createSwipeDetector(canvas, 30);
      self._swipe.onSwipe(function(dir) {
        if (dir === 'tap') return;
        var map = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
        self._nextDir = map[dir] || null;
      });

      // Keyboard
      self._keyDown = function(e) {
        var map = { ArrowUp: {x:0,y:-1}, ArrowDown: {x:0,y:1}, ArrowLeft: {x:-1,y:0}, ArrowRight: {x:1,y:0},
                    w: {x:0,y:-1}, s: {x:0,y:1}, a: {x:-1,y:0}, d: {x:1,y:0} };
        var d = map[e.key];
        if (d) { e.preventDefault(); self._nextDir = d; }
      };
      window.addEventListener('keydown', self._keyDown);
    },

    start: function() {
      this.restart();
      this.showOverlay('PAC-MAN', 'Clear the maze!', null, 'START');
      this.state = 'title';
    },

    restart: function() {
      var self = this;
      self.lives = 3;
      self._modeIdx = 0;
      self._modeTimer = MODE_TIMES[0];
      self._extraLifeGiven = false;
      self._frightTimer = 0;

      // Copy maze dots
      self._maze = [];
      for (var y = 0; y < GRID; y++) {
        self._maze[y] = [];
        for (var x = 0; x < GRID; x++) {
          self._maze[y][x] = mazeLayout[y][x];
        }
      }
      // Place power pellets
      for (var p = 0; p < pelletPositions.length; p++) {
        var pp = pelletPositions[p];
        self._maze[pp[1]][pp[0]] = 3;
      }

      // Pac-Man at center
      var center = tileCenter(7, 7);
      self.pac = { x: center.x, y: center.y, dir: {x:0,y:0}, mouth: 0, mouthOpen: true };

      // Ghosts at their home corners
      var ghostStarts = [{x:7,y:5,c:'#ff006e'},{x:7,y:7,c:'#ffbe0b'},{x:5,y:7,c:'#00f0ff'},{x:9,y:7,c:'#ff9900'}];
      self.ghosts = [];
      for (var g = 0; g < 4; g++) {
        var gs = ghostStarts[g];
        var gc = tileCenter(gs.x, gs.y);
        self.ghosts.push({
          x: gc.x, y: gc.y,
          color: gs.c,
          dir: {x:0,y:0},
          frightened: false,
          eaten: false,
          scatterTarget: g < 2 ? {x:1*28+14,y:1*28+14} : {x:13*28+14,y:13*28+14}
        });
      }
    },

    _tx: function(px) { return Math.round((px - OFFSET_X - TILE/2) / TILE); },
    _ty: function(py) { return Math.round((py - OFFSET_Y - TILE/2) / TILE); },
    _cx: function(tx) { return OFFSET_X + tx * TILE + TILE/2; },
    _cy: function(ty) { return OFFSET_Y + ty * TILE + TILE/2; },

    _atCenter: function(ox, oy, tx, ty) {
      var cx = this._cx(tx), cy = this._cy(ty);
      return Math.abs(ox - cx) < 2 && Math.abs(oy - cy) < 2;
    },

    _reverseDir: function(dir) {
      return { x: -dir.x, y: -dir.y };
    },

    _ghostTarget: function(gi) {
      var self = this;
      var ghost = this.ghosts[gi];
      if (ghost.eaten) return tileCenter(7, 7);

      var gt = tileCenter(this._tx(this.pac.x), this._ty(this.pac.y));

      if (gi === 0) return gt; // Blinky targets pac directly

      var ahead = { x: this.pac.x + this.pac.dir.x * 4 * TILE, y: this.pac.y + this.pac.dir.y * 4 * TILE };
      if (gi === 1) return ahead; // Pinky: ahead of pac

      if (gi === 2) { // Inky: double vector from Blinky to 2 ahead of pac
        var blinkyPos = { x: this.ghosts[0].x, y: this.ghosts[0].y };
        var twoAhead = { x: this.pac.x + this.pac.dir.x * 2 * TILE, y: this.pac.y + this.pac.dir.y * 2 * TILE };
        return { x: blinkyPos.x + (twoAhead.x - blinkyPos.x) * 2, y: blinkyPos.y + (twoAhead.y - blinkyPos.y) * 2 };
      }

      if (gi === 3) { // Clyde
        var dx = this.pac.x - ghost.x, dy = this.pac.y - ghost.y;
        var dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > 8 * TILE) return gt;
        return { x: 1 * TILE + OFFSET_X + TILE/2, y: 13 * TILE + OFFSET_Y + TILE/2 };
      }

      return gt;
    },

    _chooseDirection: function(x, y, dir, target, canReverse) {
      var cx = this._cx(this._tx(x)), cy = this._cy(this._ty(y));
      // Must be at center to turn
      if (Math.abs(x - cx) > 2 || Math.abs(y - cy) > 2) return dir;

      var tx = this._tx(x), ty = this._ty(y);
      var options = [{x:0,y:-1},{x:0,y:1},{x:-1,y:0},{x:1,y:0}];
      var bestDir = null;
      var bestDist = Infinity;
      var reverse = canReverse ? null : this._reverseDir(dir);

      for (var i = 0; i < options.length; i++) {
        var od = options[i];
        if (reverse && od.x === reverse.x && od.y === reverse.y) continue;
        if (isWall(tx + od.x, ty + od.y)) continue;
        var nx = cx + od.x * TILE, ny = cy + od.y * TILE;
        var dist = (nx - target.x) * (nx - target.x) + (ny - target.y) * (ny - target.y);
        if (dist < bestDist) {
          bestDist = dist;
          bestDir = od;
        }
      }
      return bestDir || dir;
    },

    _randomDirection: function(x, y, dir) {
      var cx = this._cx(this._tx(x)), cy = this._cy(this._ty(y));
      if (Math.abs(x - cx) > 2 || Math.abs(y - cy) > 2) return dir;
      var tx = this._tx(x), ty = this._ty(y);
      var reverse = this._reverseDir(dir);
      var candidates = [];
      var options = [{x:0,y:-1},{x:0,y:1},{x:-1,y:0},{x:1,y:0}];
      for (var i = 0; i < options.length; i++) {
        var od = options[i];
        if (od.x === reverse.x && od.y === reverse.y) continue;
        if (!isWall(tx + od.x, ty + od.y)) candidates.push(od);
      }
      if (candidates.length === 0) return dir;
      return candidates[Math.floor(Math.random() * candidates.length)];
    },

    update: function(dt) {
      var self = this;
      if (self.state !== 'playing') return;

      // Mode timer
      self._modeTimer -= dt;
      if (self._modeTimer <= 0) {
        self._modeIdx = (self._modeIdx + 1) % MODE_TIMES.length;
        self._modeTimer = MODE_TIMES[self._modeIdx];
        // Ghosts reverse direction on mode change
        for (var go = 0; go < self.ghosts.length; go++) {
          if (!self.ghosts[go].eaten) self.ghosts[go].dir = self._reverseDir(self.ghosts[go].dir);
        }
      }

      // Frighten timer (from power pellet)
      if (self._frightTimer > 0) {
        self._frightTimer -= dt;
        if (self._frightTimer <= 0) {
          for (var gf = 0; gf < self.ghosts.length; gf++) {
            self.ghosts[gf].frightened = false;
          }
        }
      }

      // ── Pac-Man movement ──
      var pac = self.pac;
      var ptx = self._tx(pac.x), pty = self._ty(pac.y);

      // Try queued direction
      if (self._nextDir) {
        var nd = self._nextDir;
        // Test if can turn into that tile
        var ntx = ptx + nd.x, nty = pty + nd.y;
        if (!isWall(ntx, nty) && self._atCenter(pac.x, pac.y, ptx, pty)) {
          pac.dir = nd;
          // Snap to center
          pac.x = self._cx(ptx);
          pac.y = self._cy(pty);
          self._nextDir = null;
        } else if (!isWall(ptx + pac.dir.x, pty + pac.dir.y)) {
          // Still moving in current dir, keep nextDir queued
        }
      }

      // Move Pac-Man
      if (pac.dir.x !== 0 || pac.dir.y !== 0) {
        var newPx = pac.x + pac.dir.x * PAC_SPEED * dt;
        var newPy = pac.y + pac.dir.y * PAC_SPEED * dt;
        var newTx = self._tx(newPx), newTy = self._ty(newPy);

        if (isWall(newTx, newTy)) {
          // Stop at wall
          pac.x = self._cx(ptx);
          pac.y = self._cy(pty);
          pac.dir = {x:0,y:0};
        } else {
          pac.x = newPx;
          pac.y = newPy;

          // Eat dots
          var curTx = self._tx(pac.x), curTy = self._ty(pac.y);
          if (curTx >= 0 && curTy >= 0 && curTx < GRID && curTy < GRID) {
            var cell = self._maze[curTy][curTx];
            if (cell === 2) {
              self._maze[curTy][curTx] = 0;
              self.addScore(DOT_PTS);
            } else if (cell === 3) {
              self._maze[curTy][curTx] = 0;
              self.addScore(PELLET_PTS);
              self._frightTimer = FRIGHTEN_TIME;
              for (var gf = 0; gf < self.ghosts.length; gf++) {
                self.ghosts[gf].frightened = true;
                self.ghosts[gf].dir = self._reverseDir(self.ghosts[gf].dir);
              }
            }
          }
        }
      }

      // Mouth animation
      pac.mouthTimer = (pac.mouthTimer || 0) + dt;
      if (pac.mouthTimer > 0.12) {
        pac.mouthTimer = 0;
        pac.mouthOpen = !pac.mouthOpen;
        pac.mouth = pac.mouthOpen ? 45 : 5;
      }

      // Extra life
      if (!self._extraLifeGiven && self.score >= EXTRA_LIFE_SCORE) {
        self._extraLifeGiven = true;
        self.lives++;
      }

      // ── Ghost movement ──
      var isScatter = (self._modeIdx % 2 === 0); // Even indices are scatter
      for (var g = 0; g < self.ghosts.length; g++) {
        var ghost = self.ghosts[g];

        if (ghost.frightened) {
          ghost.dir = self._randomDirection(ghost.x, ghost.y, ghost.dir);
        } else if (ghost.eaten) {
          var target = tileCenter(7, 7);
          ghost.dir = self._chooseDirection(ghost.x, ghost.y, ghost.dir, target, false);
          // Reached home?
          if (Math.abs(ghost.x - target.x) < 10 && Math.abs(ghost.y - target.y) < 10) {
            ghost.eaten = false;
            ghost.frightened = false;
          }
        } else if (isScatter) {
          ghost.dir = self._chooseDirection(ghost.x, ghost.y, ghost.dir, ghost.scatterTarget, false);
        } else {
          var gtarget = self._ghostTarget(g);
          ghost.dir = self._chooseDirection(ghost.x, ghost.y, ghost.dir, gtarget, false);
        }

        var gspeed = ghost.frightened ? GHOST_FRIGHT_SPEED : (ghost.eaten ? GHOST_SPEED * 2 : GHOST_SPEED);
        ghost.x += ghost.dir.x * gspeed * dt;
        ghost.y += ghost.dir.y * gspeed * dt;

        // Keep in bounds
        if (self._tx(ghost.x) < 0) ghost.x = 0;
        if (self._tx(ghost.x) >= GRID) ghost.x = self._cx(GRID - 1);
      }

      // ── Pac-Man vs Ghost collision ──
      for (var g2 = 0; g2 < self.ghosts.length; g2++) {
        var ghost2 = self.ghosts[g2];
        var dx = pac.x - ghost2.x, dy = pac.y - ghost2.y;
        var dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < PAC_R + GHOST_R) {
          if (ghost2.frightened && !ghost2.eaten) {
            // Eat ghost
            ghost2.eaten = true;
            ghost2.frightened = false;
            var eatScore = [200, 400, 800, 1600][self._ghostEatenCount || 0] || 200;
            self.addScore(eatScore);
            self._ghostEatenCount = (self._ghostEatenCount || 0) + 1;
          } else if (!ghost2.eaten) {
            // Pac-Man dies
            self.lives--;
            if (self.lives <= 0) {
              self.gameOver();
              return;
            }
            // Reset positions
            var ctr = tileCenter(7, 7);
            self.pac.x = ctr.x; self.pac.y = ctr.y;
            self.pac.dir = {x:0,y:0};
            self._nextDir = null;
            self._frightTimer = 0;
            self._ghostEatenCount = 0;
            var gss = [{x:7,y:5},{x:7,y:7},{x:5,y:7},{x:9,y:7}];
            for (var gr = 0; gr < self.ghosts.length; gr++) {
              var gcs = gss[gr];
              var gcp = tileCenter(gcs.x, gcs.y);
              self.ghosts[gr].x = gcp.x;
              self.ghosts[gr].y = gcp.y;
              self.ghosts[gr].dir = {x:0,y:0};
              self.ghosts[gr].frightened = false;
              self.ghosts[gr].eaten = false;
            }
            break;
          }
        }
      }

      // ── Check win (all dots eaten) ──
      var hasDot = false;
      for (var y2 = 0; y2 < GRID; y2++) {
        for (var x2 = 0; x2 < GRID; x2++) {
          if (self._maze[y2][x2] === 2 || self._maze[y2][x2] === 3) {
            hasDot = true;
            break;
          }
        }
        if (hasDot) break;
      }
      if (!hasDot) {
        self.addScore(1000);
        self.restart();
      }
    },

    draw: function(ctx) {
      var self = this;
      if (!self._maze) return;

      // Background
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, 400, 440);

      // ── Maze ──
      for (var y = 0; y < GRID; y++) {
        for (var x = 0; x < GRID; x++) {
          var cell = self._maze[y][x];
          if (cell === 1) {
            // Wall
            var wx = OFFSET_X + x * TILE;
            var wy = OFFSET_Y + y * TILE;
            ctx.fillStyle = '#2233cc';
            ctx.fillRect(wx, wy, TILE - 1, TILE - 1);
            // Wall border
            ctx.strokeStyle = '#4455ff';
            ctx.lineWidth = 1;
            ctx.strokeRect(wx + 1, wy + 1, TILE - 3, TILE - 3);
          } else if (cell === 2) {
            // Dot
            var cx = OFFSET_X + x * TILE + TILE / 2;
            var cy = OFFSET_Y + y * TILE + TILE / 2;
            ctx.fillStyle = '#ffbe0b';
            ctx.beginPath();
            ctx.arc(cx, cy, 3, 0, Math.PI * 2);
            ctx.fill();
          } else if (cell === 3) {
            // Power pellet
            var px = OFFSET_X + x * TILE + TILE / 2;
            var py = OFFSET_Y + y * TILE + TILE / 2;
            var pulse = Math.sin(Date.now() / 200) * 2 + 7;
            ctx.fillStyle = '#ffbe0b';
            ctx.shadowColor = '#ffbe0b';
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(px, py, pulse, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }
      }

      // ── Pac-Man ──
      var pac = self.pac;
      var dirAngle = Math.atan2(pac.dir.y, pac.dir.x);
      if (pac.dir.x === 0 && pac.dir.y === 0) dirAngle = 0;

      ctx.fillStyle = '#ffff00';
      ctx.shadowColor = '#ffff00';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      var mouthR = pac.mouth * Math.PI / 180;
      ctx.arc(pac.x, pac.y, PAC_R, dirAngle + mouthR, dirAngle + Math.PI * 2 - mouthR);
      ctx.lineTo(pac.x, pac.y);
      ctx.fill();
      ctx.shadowBlur = 0;

      // ── Ghosts ──
      for (var g = 0; g < self.ghosts.length; g++) {
        var ghost = self.ghosts[g];

        if (ghost.eaten) {
          // Only draw eyes
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(ghost.x - 4, ghost.y - 3, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(ghost.x + 4, ghost.y - 3, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#00f';
          ctx.beginPath();
          ctx.arc(ghost.x - 4 + ghost.dir.x, ghost.y - 3 + ghost.dir.y, 1.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(ghost.x + 4 + ghost.dir.x, ghost.y - 3 + ghost.dir.y, 1.5, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }

        var gcolor = ghost.frightened ? '#2121de' : ghost.color;
        if (ghost.frightened && self._frightTimer < 2 && Math.floor(Date.now() / 150) % 2 === 0) {
          gcolor = '#ffffff';
        }

        ctx.fillStyle = gcolor;
        ctx.beginPath();
        ctx.arc(ghost.x, ghost.y - 2, GHOST_R, Math.PI, 0);
        // Wavy bottom
        var gx = ghost.x - GHOST_R;
        var gy = ghost.y - 2;
        ctx.lineTo(ghost.x + GHOST_R, gy);
        var wave = Math.sin(Date.now() / 100 + g) * 3;
        for (var w = 0; w < 3; w++) {
          var wx1 = gx + (GHOST_R * 2 / 3) * w;
          var wx2 = wx1 + GHOST_R * 2 / 3;
          ctx.lineTo(wx2, gy + GHOST_R + wave + (w % 2 === 0 ? 4 : -4));
        }
        ctx.closePath();
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ghost.x - 4, ghost.y - 5, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ghost.x + 4, ghost.y - 5, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#00f';
        ctx.beginPath();
        ctx.arc(ghost.x - 4 + ghost.dir.x, ghost.y - 5 + ghost.dir.y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ghost.x + 4 + ghost.dir.x, ghost.y - 5 + ghost.dir.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── Lives (bottom) ──
      var livesY = 430;
      for (var l = 0; l < self.lives; l++) {
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(30 + l * 28, livesY, 8, 0.25, Math.PI * 2 - 0.25);
        ctx.lineTo(26 + l * 28, livesY);
        ctx.fill();
      }
    }
  });
})();
