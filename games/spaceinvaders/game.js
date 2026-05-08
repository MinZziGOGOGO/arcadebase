// SPACE INVADERS — ArcadeBase
// 400×500 canvas, 5×10 alien formation, barriers, mothership, touch drag + tap

(function() {
  var SHIP_W = 28;
  var SHIP_H = 16;
  var SHIP_Y = 460;
  var SHIP_SPEED = 300;
  var ALIEN_COLS = 10;
  var ALIEN_ROWS = 5;
  var ALIEN_W = 20;
  var ALIEN_H = 14;
  var ALIEN_GAP_X = 8;
  var ALIEN_GAP_Y = 10;
  var ALIEN_START_X = 40;
  var ALIEN_START_Y = 50;
  var ALIEN_BASE_SPEED = 60;
  var ALIEN_DROP = 14;
  var BULLET_W = 3;
  var BULLET_H = 10;
  var BULLET_SPEED = 420;
  var ALIEN_BULLET_SPEED = 200;
  var ALIEN_SHOOT_INTERVAL = 0.7;
  var BARRIER_COUNT = 3;
  var BARRIER_W = 50;
  var BARRIER_H = 30;
  var BARRIER_CELL = 5;
  var MOTHERSHIP_W = 32;
  var MOTHERSHIP_H = 14;
  var MOTHERSHIP_SPEED = 120;
  var MOTHERSHIP_MIN = 25;
  var MOTHERSHIP_MAX = 35;
  var BONUS_VALUES = [50, 100, 150, 200, 300];
  var ROW_SCORES = [40, 20, 20, 10, 10];

  var game = GameBase.create({
    container: document.getElementById('canvas-wrapper'),
    canvasW: 400,
    canvasH: 500,
    gameKey: 'spaceinvaders',
    helpText: 'Drag bottom to move ship\\nTap top to shoot, 1 bullet at a time\\nAliens speed up as you destroy them\\nMothership gives bonus points',
    helpTitle: 'INVADERS RULES',

    init: function(canvas, ctx) {
      var self = this;
      self._keys = {};
      self._shipX = 0;
      self._touchActive = false;
      self._touchFire = false;

      // Attach shoot method to self so touch handlers can call it
      self._tryShoot = function() {
        if (self.state !== 'playing') return;
        if (self._bullets.length > 0) return;
        self._bullets.push({
          x: self._shipX + SHIP_W / 2 - BULLET_W / 2,
          y: SHIP_Y - BULLET_H
        });
      };

      self._onKeyDown = function(e) {
        self._keys[e.key] = true;
      };
      self._onKeyUp = function(e) {
        self._keys[e.key] = false;
      };
      window.addEventListener('keydown', self._onKeyDown);
      window.addEventListener('keyup', self._onKeyUp);

      self._onTouchStart = function(e) {
        if (self.state !== 'playing') return;
        e.preventDefault();
        var pos = Utils.getCanvasPos(canvas, e);
        if (!pos) return;
        self._touchActive = true;
        self._touchStartY = pos.y;
        if (pos.y > SHIP_Y - 30 && pos.y < canvas.height) {
          self._shipX = pos.x - SHIP_W / 2;
        }
      };
      self._onTouchMove = function(e) {
        if (self.state !== 'playing') return;
        e.preventDefault();
        if (!self._touchActive) return;
        var pos = Utils.getCanvasPos(canvas, e);
        if (!pos) return;
        if (self._touchStartY > SHIP_Y - 30 || pos.y > SHIP_Y - 30) {
          self._shipX = pos.x - SHIP_W / 2;
        }
        if (pos.y < SHIP_Y - 30) {
          self._touchFire = true;
        }
      };
      self._onTouchEnd = function(e) {
        if (self.state !== 'playing') return;
        e.preventDefault();
        self._touchActive = false;
        if (self._touchStartY < SHIP_Y - 30 && self.state === 'playing') {
          self._tryShoot();
        }
        self._touchStartY = 0;
        self._touchFire = false;
      };
      canvas.addEventListener('touchstart', self._onTouchStart, { passive: false });
      canvas.addEventListener('touchmove', self._onTouchMove, { passive: false });
      canvas.addEventListener('touchend', self._onTouchEnd, { passive: false });

      // Mouse for desktop
      self._onMouseMove = function(e) {
        var pos = Utils.getCanvasPos(canvas, e);
        if (pos) self._shipX = pos.x - SHIP_W / 2;
      };
      self._onMouseClick = function(e) {
        if (self.state === 'playing') self._tryShoot();
      };
      canvas.addEventListener('mousemove', self._onMouseMove);
      canvas.addEventListener('click', self._onMouseClick);
    },

    start: function() {
      this.showOverlay('SPACE INVADERS', 'Defend Earth!', null, 'START');
    },

    restart: function() {
      var self = this;
      self.lives = 3;
      self._alienDir = 1;
      self._alienSpeed = ALIEN_BASE_SPEED;
      self._alienDropNow = false;
      self._aliens = [];
      self._bullets = [];
      self._alienBullets = [];
      self._mothership = null;
      self._mothershipTimer = MOTHERSHIP_MIN + Math.random() * (MOTHERSHIP_MAX - MOTHERSHIP_MIN);
      self._alienShootTimer = 0;
      self._shipX = (this.canvas.width - SHIP_W) / 2;
      self._shipHit = false;
      self._shipHitTimer = 0;
      self._touchFire = false;

      // Create aliens
      for (var r = 0; r < ALIEN_ROWS; r++) {
        for (var c = 0; c < ALIEN_COLS; c++) {
          self._aliens.push({
            x: ALIEN_START_X + c * (ALIEN_W + ALIEN_GAP_X),
            y: ALIEN_START_Y + r * (ALIEN_H + ALIEN_GAP_Y),
            w: ALIEN_W, h: ALIEN_H,
            row: r, alive: true
          });
        }
      }

      // Create barriers
      self._barriers = [];
      var barrierSpacing = (this.canvas.width - 20) / BARRIER_COUNT;
      for (var b = 0; b < BARRIER_COUNT; b++) {
        var bx = 35 + b * barrierSpacing;
        var cells = [];
        for (var cy = 0; cy < BARRIER_H / BARRIER_CELL; cy++) {
          for (var cx = 0; cx < BARRIER_W / BARRIER_CELL; cx++) {
            cells.push({ x: cx, y: cy, alive: true });
          }
        }
        self._barriers.push({ x: bx, y: 410, cells: cells });
      }
    },

    _tryShoot: function() {
      if (this.state !== 'playing') return;
      if (this._bullets.length > 0) return;
      this._bullets.push({
        x: this._shipX + SHIP_W / 2 - BULLET_W / 2,
        y: SHIP_Y - BULLET_H
      });
    },

    update: function(dt) {
      var self = this;
      var canvas = this.canvas;

      // Ship hit cooldown
      if (self._shipHit) {
        self._shipHitTimer -= dt;
        if (self._shipHitTimer <= 0) {
          self._shipHit = false;
          self._shipHitTimer = 0;
        }
      }

      if (self.state !== 'playing') return;

      // Ship movement
      var shipX = self._shipX;
      if (self._keys['ArrowLeft'] || self._keys['a'] || self._keys['A'])
        shipX -= SHIP_SPEED * dt;
      if (self._keys['ArrowRight'] || self._keys['d'] || self._keys['D'])
        shipX += SHIP_SPEED * dt;
      if (self._keys[' '] || self._keys['ArrowUp']) {
        self._tryShoot();
        self._keys[' '] = false;
        self._keys['ArrowUp'] = false;
      }
      self._shipX = Math.max(0, Math.min(canvas.width - SHIP_W, shipX));

      // Touch fire
      if (self._touchFire && self.state === 'playing') {
        self._tryShoot();
        self._touchFire = false;
      }

      // Mothership timer
      self._mothershipTimer -= dt;
      if (self._mothershipTimer <= 0 && !self._mothership) {
        self._mothershipTimer = MOTHERSHIP_MIN + Math.random() * (MOTHERSHIP_MAX - MOTHERSHIP_MIN);
        self._mothership = {
          x: canvas.width,
          y: 20,
          w: MOTHERSHIP_W,
          h: MOTHERSHIP_H,
          bonus: BONUS_VALUES[Math.floor(Math.random() * BONUS_VALUES.length)]
        };
      }

      // Move mothership
      if (self._mothership) {
        self._mothership.x -= MOTHERSHIP_SPEED * dt;
        if (self._mothership.x + MOTHERSHIP_W < -10) {
          self._mothership = null;
        }
      }

      // Move player bullets
      for (var i = self._bullets.length - 1; i >= 0; i--) {
        var b = self._bullets[i];
        b.y -= BULLET_SPEED * dt;
        if (b.y < -BULLET_H) {
          self._bullets.splice(i, 1);
          continue;
        }
        // Hit mothership
        if (self._mothership && self._mothership.x < b.x + BULLET_W &&
            self._mothership.x + MOTHERSHIP_W > b.x &&
            self._mothership.y < b.y + BULLET_H &&
            self._mothership.y + MOTHERSHIP_H > b.y) {
          self.addScore(self._mothership.bonus);
          self._mothership = null;
          self._bullets.splice(i, 1);
          continue;
        }
        // Hit aliens
        for (var a = self._aliens.length - 1; a >= 0; a--) {
          var alien = self._aliens[a];
          if (!alien.alive) continue;
          if (alien.x < b.x + BULLET_W && alien.x + ALIEN_W > b.x &&
              alien.y < b.y + BULLET_H && alien.y + ALIEN_H > b.y) {
            alien.alive = false;
            self.addScore(ROW_SCORES[alien.row]);
            self._bullets.splice(i, 1);
            // Speed up remaining aliens
            var aliveCount = 0;
            for (var aa = 0; aa < self._aliens.length; aa++)
              if (self._aliens[aa].alive) aliveCount++;
            self._alienSpeed = ALIEN_BASE_SPEED + (ALIEN_ROWS * ALIEN_COLS - aliveCount) * 3;
            break;
          }
        }
        // Hit barriers
        for (var br = 0; br < self._barriers.length; br++) {
          var bar = self._barriers[br];
          if (b.x + BULLET_W > bar.x && b.x < bar.x + BARRIER_W &&
              b.y + BULLET_H > bar.y && b.y < bar.y + BARRIER_H) {
            var cx = Math.floor((b.x - bar.x + BULLET_W / 2) / BARRIER_CELL);
            var cy = Math.floor((b.y + BULLET_H - bar.y) / BARRIER_CELL);
            for (var k = bar.cells.length - 1; k >= 0; k--) {
              var cell = bar.cells[k];
              if (cell.x === cx && cell.y === cy && cell.alive) {
                cell.alive = false;
                self._bullets.splice(i, 1);
                // Also damage adjacent cells
                for (var dc = -1; dc <= 1; dc++) {
                  for (var dr = -1; dr <= 1; dr++) {
                    if (dc === 0 && dr === 0) continue;
                    for (var k2 = bar.cells.length - 1; k2 >= 0; k2--) {
                      var c2 = bar.cells[k2];
                      if (c2.x === cx + dc && c2.y === cy + dr && c2.alive) {
                        c2.alive = false;
                      }
                    }
                  }
                }
                break;
              }
            }
            break;
          }
        }
      }

      // Alien movement
      var alienEdge = false;
      var alienBottom = 0;
      for (var a = 0; a < self._aliens.length; a++) {
        var alien = self._aliens[a];
        if (!alien.alive) continue;
        var newX = alien.x + self._alienDir * self._alienSpeed * dt;
        if (newX <= 2 || newX + ALIEN_W >= canvas.width - 2) {
          alienEdge = true;
        }
        if (alien.y + ALIEN_H > alienBottom) alienBottom = alien.y + ALIEN_H;
      }

      if (self._alienDropNow) {
        for (var a2 = 0; a2 < self._aliens.length; a2++) {
          if (!self._aliens[a2].alive) continue;
          self._aliens[a2].y += ALIEN_DROP;
        }
        self._alienDir *= -1;
        self._alienDropNow = false;
      } else if (alienEdge) {
        self._alienDropNow = true;
      } else {
        for (var a3 = 0; a3 < self._aliens.length; a3++) {
          if (!self._aliens[a3].alive) continue;
          self._aliens[a3].x += self._alienDir * self._alienSpeed * dt;
        }
      }

      // Aliens reach bottom = game over
      if (alienBottom >= SHIP_Y - 10) {
        self.gameOver();
        return;
      }

      // Check if all aliens dead
      var anyAlive = false;
      for (var a4 = 0; a4 < self._aliens.length; a4++) {
        if (self._aliens[a4].alive) { anyAlive = true; break; }
      }
      if (!anyAlive) {
        self.addScore(1000);
        self.restart();
        return;
      }

      // Alien bullets
      self._alienShootTimer -= dt;
      if (self._alienShootTimer <= 0) {
        self._alienShootTimer = ALIEN_SHOOT_INTERVAL + Math.random() * 0.5;
        // Pick a random alien in the bottom row of its column
        var bottomAliens = [];
        for (var c = 0; c < ALIEN_COLS; c++) {
          var best = null;
          for (var a5 = 0; a5 < self._aliens.length; a5++) {
            var al = self._aliens[a5];
            if (!al.alive) continue;
            if (al.y + ALIEN_H > (best ? best.y + ALIEN_H : -1)) best = al;
            if (best && al.y + ALIEN_H > best.y + ALIEN_H) best = al;
          }
          if (best) bottomAliens.push(best);
        }
        if (bottomAliens.length > 0) {
          var shooter = bottomAliens[Math.floor(Math.random() * bottomAliens.length)];
          self._alienBullets.push({
            x: shooter.x + ALIEN_W / 2 - 2,
            y: shooter.y + ALIEN_H
          });
        }
      }

      // Move alien bullets
      for (var i2 = self._alienBullets.length - 1; i2 >= 0; i2--) {
        var ab = self._alienBullets[i2];
        ab.y += ALIEN_BULLET_SPEED * dt;
        if (ab.y > canvas.height) {
          self._alienBullets.splice(i2, 1);
          continue;
        }
        // Hit ship
        if (!self._shipHit &&
            ab.x > self._shipX && ab.x < self._shipX + SHIP_W &&
            ab.y > SHIP_Y && ab.y < SHIP_Y + SHIP_H) {
          self._alienBullets.splice(i2, 1);
          self.lives--;
          if (self.lives <= 0) {
            self.gameOver();
            return;
          }
          self._shipHit = true;
          self._shipHitTimer = 2;
          continue;
        }
        // Hit barriers
        for (var br2 = 0; br2 < self._barriers.length; br2++) {
          var bar2 = self._barriers[br2];
          if (ab.x > bar2.x && ab.x < bar2.x + BARRIER_W &&
              ab.y > bar2.y && ab.y < bar2.y + BARRIER_H) {
            var cxb = Math.floor((ab.x - bar2.x) / BARRIER_CELL);
            var cyb = Math.floor((ab.y - bar2.y) / BARRIER_CELL);
            for (var k3 = bar2.cells.length - 1; k3 >= 0; k3--) {
              var cell3 = bar2.cells[k3];
              if (cell3.x === cxb && cell3.y === cyb && cell3.alive) {
                cell3.alive = false;
                self._alienBullets.splice(i2, 1);
                break;
              }
            }
            break;
          }
        }
      }
    },

    draw: function(ctx) {
      var self = this;
      var canvas = this.canvas;

      // Background
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Stars
      ctx.fillStyle = '#ffffff33';
      for (var s = 0; s < 30; s++) {
        var sx = ((s * 127 + 53) % canvas.width);
        var sy = ((canvas.height - (s * 73 + 31) % canvas.height) % (canvas.height - 40));
        ctx.fillRect(sx, sy, 1, 1);
      }

      // ── Barriers ──
      for (var b = 0; b < self._barriers.length; b++) {
        var bar = self._barriers[b];
        for (var c = 0; c < bar.cells.length; c++) {
          var cell = bar.cells[c];
          if (!cell.alive) continue;
          ctx.fillStyle = '#39ff14';
          ctx.globalAlpha = 0.8;
          ctx.fillRect(bar.x + cell.x * BARRIER_CELL, bar.y + cell.y * BARRIER_CELL, BARRIER_CELL - 1, BARRIER_CELL - 1);
        }
      }
      ctx.globalAlpha = 1;

      // ── Aliens ──
      var alienDraws = [
        function(x, y) { // Squid (row 3,4)
          ctx.fillStyle = '#8338ec';
          ctx.fillRect(x + 4, y, 12, 4);
          ctx.fillRect(x + 2, y + 4, 4, 4);
          ctx.fillRect(x + 14, y + 4, 4, 4);
          ctx.fillRect(x, y + 8, 4, 4);
          ctx.fillRect(x + 8, y + 8, 4, 4);
          ctx.fillRect(x + 16, y + 8, 4, 4);
        },
        function(x, y) { // Crab (row 1,4)
          ctx.fillStyle = '#00f0ff';
          ctx.fillRect(x + 6, y, 8, 4);
          ctx.fillRect(x + 2, y + 4, 16, 3);
          ctx.fillRect(x, y + 7, 6, 4);
          ctx.fillRect(x + 8, y + 7, 4, 4);
          ctx.fillRect(x + 14, y + 7, 6, 4);
        },
        function(x, y) { // Octopus (row 2)
          ctx.fillStyle = '#ffbe0b';
          ctx.fillRect(x + 4, y, 12, 4);
          ctx.fillRect(x + 2, y + 4, 16, 3);
          ctx.fillRect(x, y + 7, 4, 4);
          ctx.fillRect(x + 6, y + 7, 4, 2);
          ctx.fillRect(x + 12, y + 7, 4, 2);
          ctx.fillRect(x + 16, y + 7, 4, 4);
        }
      ];
      var rowTypes = [1, 2, 1, 0, 0]; // Row 0=bottom (crab), row 1=octopus, row 2=crab, row 3=squid, row 4=squid
      for (var a = 0; a < self._aliens.length; a++) {
        var alien = self._aliens[a];
        if (!alien.alive) continue;
        var drawFn = alienDraws[rowTypes[alien.row]];
        if (drawFn) drawFn(Math.round(alien.x), Math.round(alien.y));
      }

      // ── Mothership ──
      if (self._mothership) {
        var ms = self._mothership;
        ctx.fillStyle = '#ff006e';
        ctx.fillRect(ms.x + 6, ms.y, 20, 4);
        ctx.fillRect(ms.x + 4, ms.y + 4, 24, 4);
        ctx.fillRect(ms.x, ms.y + 8, 12, 4);
        ctx.fillRect(ms.x + 12, ms.y + 8, 8, 2);
        ctx.fillRect(ms.x + 20, ms.y + 8, 12, 4);
        ctx.shadowColor = '#ff006e';
        ctx.shadowBlur = 8;
        ctx.fillText(self._mothership.bonus, ms.x + 6, ms.y - 4);
        ctx.shadowBlur = 0;
      }

      // ── Ship ──
      if (!self._shipHit || Math.floor(self._shipHitTimer * 10) % 2 === 0) {
        var sx = Math.round(self._shipX);
        ctx.fillStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(sx + SHIP_W / 2, SHIP_Y);
        ctx.lineTo(sx, SHIP_Y + SHIP_H);
        ctx.lineTo(sx + SHIP_W, SHIP_Y + SHIP_H);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        // Cannon
        ctx.fillStyle = '#66ffff';
        ctx.fillRect(sx + SHIP_W / 2 - 2, SHIP_Y - 4, 4, 6);
      }

      // ── Player bullets ──
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 4;
      for (var bi = 0; bi < self._bullets.length; bi++) {
        var bull = self._bullets[bi];
        ctx.fillRect(Math.round(bull.x), Math.round(bull.y), BULLET_W, BULLET_H);
      }
      ctx.shadowBlur = 0;

      // ── Alien bullets ──
      ctx.fillStyle = '#ff006e';
      for (var bi2 = 0; bi2 < self._alienBullets.length; bi2++) {
        var ab = self._alienBullets[bi2];
        ctx.fillRect(Math.round(ab.x), Math.round(ab.y), 3, 6);
      }

      // ── Lives (top right) ──
      for (var l = 0; l < self.lives; l++) {
        var lx = canvas.width - 18 - l * 22;
        ctx.fillStyle = '#00f0ff';
        ctx.beginPath();
        ctx.moveTo(lx + 6, 12);
        ctx.lineTo(lx, 22);
        ctx.lineTo(lx + 12, 22);
        ctx.closePath();
        ctx.fill();
      }
    }
  });
})();
