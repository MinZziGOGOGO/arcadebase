// ASTEROIDS — ArcadeBase
// 400×400 canvas, vector graphics, ship + asteroids + UFOs + buttons

(function() {
  var SHIP_SIZE = 20;
  var ROT_SPEED = 4.0;
  var THRUST_ACCEL = 200;
  var FRICTION = 0.99;
  var MAX_SPEED = 300;
  var BULLET_SPEED = 500;
  var BULLET_LIFE = 1.5;
  var MAX_BULLETS = 4;
  var UFO_BULLET_SPEED = 300;
  var UFO_BULLET_LIFE = 2;
  var INVULN_TIME = 2;
  var EXTRA_LIFE_SCORE = 10000;

  function createAsteroidShape(r) {
    var n = 8 + Math.floor(Math.random() * 5);
    var verts = [];
    for (var i = 0; i < n; i++) {
      var angle = (i / n) * Math.PI * 2;
      var vr = r * (0.7 + Math.random() * 0.6);
      verts.push({ x: Math.cos(angle) * vr, y: Math.sin(angle) * vr });
    }
    return verts;
  }

  function wrap(canvas, obj) {
    var r = obj.r || 10;
    if (obj.x < -r) obj.x = canvas.width + r;
    if (obj.x > canvas.width + r) obj.x = -r;
    if (obj.y < -r) obj.y = canvas.height + r;
    if (obj.y > canvas.height + r) obj.y = -r;
  }

  var game = GameBase.create({
    container: document.getElementById('canvas-wrapper'),
    canvasW: 400,
    canvasH: 400,
    gameKey: 'asteroids',
    helpText: '↺↻ = Rotate, ▲ = Thrust, 🔫 = Fire\\nDestroy all asteroids to clear wave\\nLarge UFO=200pts, Small UFO=1000pts\\nExtra ship at 10,000 points',
    helpTitle: 'ASTEROIDS RULES',

    init: function(canvas, ctx) {
      var self = this;
      self._keys = {};
      self._buttons = {};
      self._buttonTimers = {};

      // Copy _spawnUfo from opts so update() calls resolve
      self._spawnUfo = self.opts._spawnUfo;

      // Attach shoot to self so button handlers can call it
      self._shoot = function() {
        if (self._fireCooldown > 0) return;
        if (self.bullets.length >= MAX_BULLETS) return;
        if (!self.ship.alive) return;
        var bullet = {
          x: self.ship.x + Math.cos(self.ship.angle) * SHIP_SIZE,
          y: self.ship.y + Math.sin(self.ship.angle) * SHIP_SIZE,
          vx: Math.cos(self.ship.angle) * BULLET_SPEED,
          vy: Math.sin(self.ship.angle) * BULLET_SPEED,
          life: BULLET_LIFE,
          r: 2
        };
        self.bullets.push(bullet);
        self._fireCooldown = 0.15;
      };

      self._onKeyDown = function(e) { self._keys[e.key] = true; };
      self._onKeyUp = function(e) { self._keys[e.key] = false; };
      window.addEventListener('keydown', self._onKeyDown);
      window.addEventListener('keyup', self._onKeyUp);

      // Wire buttons from HTML
      var btnIds = ['btn-rotl', 'btn-rotr', 'btn-thrust', 'btn-fire'];
      var btnMap = { 'btn-rotl': 'rotl', 'btn-rotr': 'rotr', 'btn-thrust': 'thrust', 'btn-fire': 'fire' };
      for (var b = 0; b < btnIds.length; b++) {
        (function(btnId, key) {
          var btn = document.getElementById(btnId);
          if (!btn) return;
          self._buttons[key] = false;

          btn.addEventListener('mousedown', function(e) { e.preventDefault(); self._buttons[key] = true; });
          btn.addEventListener('mouseup', function(e) { e.preventDefault(); self._buttons[key] = false; });
          btn.addEventListener('mouseleave', function(e) { self._buttons[key] = false; });
          btn.addEventListener('touchstart', function(e) { e.preventDefault(); self._buttons[key] = true; });
          btn.addEventListener('touchend', function(e) { e.preventDefault(); self._buttons[key] = false; });
          btn.addEventListener('touchcancel', function(e) { self._buttons[key] = false; });
        })(btnIds[b], btnMap[btnIds[b]]);
      }
    },

    start: function() {
      this.showOverlay('ASTEROIDS', 'Destroy them all!', null, 'START');
    },

    restart: function() {
      var self = this;
      var canvas = this.canvas;

      self.lives = 3;
      self.ship = {
        x: canvas.width / 2, y: canvas.height / 2,
        vx: 0, vy: 0,
        angle: -Math.PI / 2,
        invuln: INVULN_TIME,
        alive: true
      };
      self.bullets = [];
      self.ufoBullets = [];
      self.asteroids = [];
      self.ufos = [];
      self._largeUfoTimer = 25;
      self._smallUfoTimer = 10;
      self._extraLifeGiven = false;
      self._fireCooldown = 0;
      self._ufoShootTimers = [];

      // Spawn 4 large asteroids away from center
      var attempts = 0;
      while (self.asteroids.length < 4 && attempts < 100) {
        var ax = Math.random() * canvas.width;
        var ay = Math.random() * canvas.height;
        var dx = ax - canvas.width / 2, dy = ay - canvas.height / 2;
        if (Math.sqrt(dx*dx + dy*dy) > 120) {
          self.asteroids.push({
            x: ax, y: ay,
            vx: (Math.random() - 0.5) * 100,
            vy: (Math.random() - 0.5) * 100,
            r: 50, size: 2, // large
            rot: Math.random() * Math.PI * 2,
            rotSpd: (Math.random() - 0.5) * 3,
            shape: createAsteroidShape(50)
          });
        }
        attempts++;
      }
    },

    _shoot: function() {
      var self = this;
      if (self._fireCooldown > 0) return;
      if (self.bullets.length >= MAX_BULLETS) return;
      if (!self.ship.alive) return;

      var bullet = {
        x: self.ship.x + Math.cos(self.ship.angle) * SHIP_SIZE,
        y: self.ship.y + Math.sin(self.ship.angle) * SHIP_SIZE,
        vx: Math.cos(self.ship.angle) * BULLET_SPEED,
        vy: Math.sin(self.ship.angle) * BULLET_SPEED,
        life: BULLET_LIFE,
        r: 2
      };
      self.bullets.push(bullet);
      self._fireCooldown = 0.15;
    },

    _spawnUfo: function(large) {
      var self = this;
      var canvas = this.canvas;
      var entrySide = Math.random();
      var ufo = {
        r: large ? 20 : 12,
        large: large,
        shootTimer: large ? 1.5 + Math.random() : 1 + Math.random()
      };

      if (entrySide < 0.5) {
        ufo.x = -30;
        ufo.y = 40 + Math.random() * (canvas.height / 3);
        ufo.vx = large ? 60 : 100;
        ufo.vy = 0;
      } else {
        ufo.x = canvas.width + 30;
        ufo.y = 40 + Math.random() * (canvas.height / 3);
        ufo.vx = large ? -60 : -100;
        ufo.vy = 0;
      }
      self.ufos.push(ufo);
      self._ufoShootTimers.push(ufo.shootTimer);
    },

    update: function(dt) {
      var self = this;
      var canvas = this.canvas;
      var ship = self.ship;

      if (self.state !== 'playing') return;

      // Fire cooldown
      self._fireCooldown = Math.max(0, self._fireCooldown - dt);

      // ── Ship input ──
      if (ship.alive) {
        var rotating = false;
        if (self._keys['ArrowLeft'] || self._keys['a'] || self._keys['A'] || self._buttons['rotl']) {
          ship.angle -= ROT_SPEED * dt;
          rotating = true;
        }
        if (self._keys['ArrowRight'] || self._keys['d'] || self._keys['D'] || self._buttons['rotr']) {
          ship.angle += ROT_SPEED * dt;
          rotating = true;
        }
        if (self._keys['ArrowUp'] || self._keys['w'] || self._keys['W'] || self._buttons['thrust']) {
          ship.vx += Math.cos(ship.angle) * THRUST_ACCEL * dt;
          ship.vy += Math.sin(ship.angle) * THRUST_ACCEL * dt;
          // Thrust particles
          ship.thrusting = true;
        } else {
          ship.thrusting = false;
        }
        if (self._keys[' '] || self._keys['ArrowDown'] || self._buttons['fire']) {
          self._shoot();
          self._keys[' '] = false;
          self._keys['ArrowDown'] = false;
        }

        // Friction
        ship.vx *= FRICTION;
        ship.vy *= FRICTION;

        // Speed cap
        var spd = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
        if (spd > MAX_SPEED) {
          ship.vx = ship.vx / spd * MAX_SPEED;
          ship.vy = ship.vy / spd * MAX_SPEED;
        }

        // Move ship
        ship.x += ship.vx * dt;
        ship.y += ship.vy * dt;
        wrap(canvas, ship);

        // Invulnerability
        ship.invuln = Math.max(0, ship.invuln - dt);
      }

      // ── Bullets ──
      for (var i = self.bullets.length - 1; i >= 0; i--) {
        var b = self.bullets[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;
        wrap(canvas, b);
        if (b.life <= 0) {
          self.bullets.splice(i, 1);
          continue;
        }

        // Hit asteroids
        for (var a = self.asteroids.length - 1; a >= 0; a--) {
          var ast = self.asteroids[a];
          var dx = b.x - ast.x, dy = b.y - ast.y;
          if (Math.sqrt(dx*dx + dy*dy) < ast.r) {
            self.bullets.splice(i, 1);
            // Score
            var pts = ast.size === 2 ? 20 : (ast.size === 1 ? 50 : 100);
            self.addScore(pts);

            // Split
            if (ast.size > 0) {
              for (var s = 0; s < 2; s++) {
                var newR = ast.size === 2 ? 25 : 12;
                self.asteroids.push({
                  x: ast.x + (Math.random() - 0.5) * 20,
                  y: ast.y + (Math.random() - 0.5) * 20,
                  vx: ast.vx + (Math.random() - 0.5) * 80,
                  vy: ast.vy + (Math.random() - 0.5) * 80,
                  r: newR, size: ast.size - 1,
                  rot: Math.random() * Math.PI * 2,
                  rotSpd: (Math.random() - 0.5) * 4,
                  shape: createAsteroidShape(newR)
                });
              }
            }
            self.asteroids.splice(a, 1);
            break;
          }
        }
        if (self.bullets.length === 0 || i >= self.bullets.length) continue;

        // Hit UFOs
        for (var u = self.ufos.length - 1; u >= 0; u--) {
          var ufo = self.ufos[u];
          var ux = b.x - ufo.x, uy = b.y - ufo.y;
          if (Math.sqrt(ux*ux + uy*uy) < ufo.r) {
            self.bullets.splice(i, 1);
            self.addScore(ufo.large ? 200 : 1000);
            self.ufos.splice(u, 1);
            self._ufoShootTimers.splice(u, 1);
            break;
          }
        }
      }

      // ── UFO bullets ──
      for (var j = self.ufoBullets.length - 1; j >= 0; j--) {
        var ub = self.ufoBullets[j];
        ub.x += ub.vx * dt;
        ub.y += ub.vy * dt;
        ub.life -= dt;
        wrap(canvas, ub);
        if (ub.life <= 0) {
          self.ufoBullets.splice(j, 1);
          continue;
        }

        // Hit ship
        if (ship.alive && ship.invuln <= 0) {
          var sx = ub.x - ship.x, sy = ub.y - ship.y;
          if (Math.sqrt(sx*sx + sy*sy) < SHIP_SIZE * 0.8) {
            self.ufoBullets.splice(j, 1);
            self.lives--;
            if (self.lives <= 0) {
              ship.alive = false;
              self.gameOver();
              return;
            }
            // Respawn
            ship.x = canvas.width / 2;
            ship.y = canvas.height / 2;
            ship.vx = 0; ship.vy = 0;
            ship.invuln = INVULN_TIME;
            self.bullets = [];
            continue;
          }
        }
        // Hit asteroids
        for (var a2 = self.asteroids.length - 1; a2 >= 0; a2--) {
          var ast2 = self.asteroids[a2];
          var ax2 = ub.x - ast2.x, ay2 = ub.y - ast2.y;
          if (Math.sqrt(ax2*ax2 + ay2*ay2) < ast2.r) {
            self.ufoBullets.splice(j, 1);
            break;
          }
        }
      }

      // ── Asteroids ──
      for (var a3 = 0; a3 < self.asteroids.length; a3++) {
        var ast3 = self.asteroids[a3];
        ast3.x += ast3.vx * dt;
        ast3.y += ast3.vy * dt;
        ast3.rot += ast3.rotSpd * dt;
        wrap(canvas, ast3);
      }

      // Ship-asteroid collision
      if (ship.alive && ship.invuln <= 0) {
        for (var a4 = 0; a4 < self.asteroids.length; a4++) {
          var ast4 = self.asteroids[a4];
          var dx4 = ship.x - ast4.x, dy4 = ship.y - ast4.y;
          if (Math.sqrt(dx4*dx4 + dy4*dy4) < ast4.r + SHIP_SIZE * 0.6) {
            self.lives--;
            if (self.lives <= 0) {
              ship.alive = false;
              self.gameOver();
              return;
            }
            ship.x = canvas.width / 2;
            ship.y = canvas.height / 2;
            ship.vx = 0; ship.vy = 0;
            ship.invuln = INVULN_TIME;
            self.bullets = [];
            break;
          }
        }
      }

      // ── UFOs ──
      self._largeUfoTimer -= dt;
      self._smallUfoTimer -= dt;

      if (self._largeUfoTimer <= 0) {
        self._largeUfoTimer = 25 + Math.random() * 10;
        self._spawnUfo(true);
      }
      if (self._smallUfoTimer <= 0) {
        self._smallUfoTimer = 10 + Math.random() * 5;
        self._spawnUfo(false);
      }

      for (var u2 = self.ufos.length - 1; u2 >= 0; u2--) {
        var ufo2 = self.ufos[u2];
        ufo2.x += ufo2.vx * dt;
        // Remove if off screen
        if (ufo2.x < -60 || ufo2.x > canvas.width + 60) {
          self.ufos.splice(u2, 1);
          self._ufoShootTimers.splice(u2, 1);
          continue;
        }
        // Shoot
        self._ufoShootTimers[u2] -= dt;
        if (self._ufoShootTimers[u2] <= 0) {
          self._ufoShootTimers[u2] = ufo2.large ? 1.5 + Math.random() : 1 + Math.random();
          var angle;
          if (ufo2.large) {
            angle = Math.random() * Math.PI * 2;
          } else if (ship.alive) {
            angle = Math.atan2(ship.y - ufo2.y, ship.x - ufo2.x);
            angle += (Math.random() - 0.5) * 0.5;
          } else {
            angle = Math.random() * Math.PI * 2;
          }
          self.ufoBullets.push({
            x: ufo2.x, y: ufo2.y,
            vx: Math.cos(angle) * UFO_BULLET_SPEED,
            vy: Math.sin(angle) * UFO_BULLET_SPEED,
            life: UFO_BULLET_LIFE,
            r: 2
          });
        }
      }

      // ── Extra life ──
      if (!self._extraLifeGiven && self.score >= EXTRA_LIFE_SCORE) {
        self._extraLifeGiven = true;
        self.lives++;
      }

      // ── Check asteroids cleared ──
      if (self.asteroids.length === 0 && self.state === 'playing') {
        self.addScore(500);
        // Respawn more
        for (var r5 = 0; r5 < 4; r5++) {
          var ax5 = Math.random() * canvas.width;
          var ay5 = Math.random() * canvas.height;
          self.asteroids.push({
            x: ax5, y: ay5,
            vx: (Math.random() - 0.5) * 120,
            vy: (Math.random() - 0.5) * 120,
            r: 50, size: 2,
            rot: Math.random() * Math.PI * 2,
            rotSpd: (Math.random() - 0.5) * 3,
            shape: createAsteroidShape(50)
          });
        }
      }
    },

    draw: function(ctx) {
      var self = this;
      var canvas = this.canvas;
      if (!self.ship) return;  // Not initialized until restart()

      var ship = self.ship;

      // Background
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Stars
      ctx.fillStyle = '#ffffff33';
      for (var s = 0; s < 40; s++) {
        var sx = ((s * 113 + 47) % canvas.width);
        var sy = ((s * 97 + 23) % canvas.height);
        ctx.fillRect(sx, sy, 1, 1);
      }

      // ── Asteroids ──
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 1.5;
      for (var a = 0; a < self.asteroids.length; a++) {
        var ast = self.asteroids[a];
        ctx.save();
        ctx.translate(ast.x, ast.y);
        ctx.rotate(ast.rot);
        ctx.beginPath();
        var sh = ast.shape;
        ctx.moveTo(sh[0].x, sh[0].y);
        for (var v = 1; v < sh.length; v++) {
          ctx.lineTo(sh[v].x, sh[v].y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }

      // ── Ship ──
      if (ship.alive) {
        if (ship.invuln <= 0 || Math.floor(Date.now() / 80) % 2 === 0) {
          ctx.save();
          ctx.translate(ship.x, ship.y);
          ctx.rotate(ship.angle);

          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 2;
          ctx.shadowColor = '#00f0ff';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.moveTo(SHIP_SIZE, 0);
          ctx.lineTo(-SHIP_SIZE * 0.7, -SHIP_SIZE * 0.6);
          ctx.lineTo(-SHIP_SIZE * 0.5, 0);
          ctx.lineTo(-SHIP_SIZE * 0.7, SHIP_SIZE * 0.6);
          ctx.closePath();
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Thrust flame
          if (ship.thrusting) {
            ctx.strokeStyle = '#ffbe0b';
            ctx.lineWidth = 1.5;
            ctx.shadowColor = '#ffbe0b';
            ctx.shadowBlur = 4;
            ctx.beginPath();
            ctx.moveTo(-SHIP_SIZE * 0.5, -SHIP_SIZE * 0.25);
            ctx.lineTo(-SHIP_SIZE * 0.5 - 8 - Math.random() * 6, 0);
            ctx.lineTo(-SHIP_SIZE * 0.5, SHIP_SIZE * 0.25);
            ctx.stroke();
            ctx.shadowBlur = 0;
          }
          ctx.restore();
        }
      }

      // ── Player bullets ──
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 3;
      for (var b = 0; b < self.bullets.length; b++) {
        var bul = self.bullets[b];
        ctx.beginPath();
        ctx.arc(bul.x, bul.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // ── UFO bullets ──
      ctx.fillStyle = '#ff006e';
      for (var ub = 0; ub < self.ufoBullets.length; ub++) {
        var ubl = self.ufoBullets[ub];
        ctx.beginPath();
        ctx.arc(ubl.x, ubl.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── UFOs ──
      for (var u = 0; u < self.ufos.length; u++) {
        var ufo = self.ufos[u];
        ctx.strokeStyle = ufo.large ? '#ffbe0b' : '#ff006e';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 4;

        // Saucer body
        ctx.beginPath();
        ctx.ellipse(ufo.x, ufo.y + 4, ufo.r, ufo.r * 0.35, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Dome
        ctx.beginPath();
        ctx.arc(ufo.x, ufo.y, ufo.r * 0.5, Math.PI, 0);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // ── Lives (top left, drawn mini ships) ──
      for (var l = 0; l < self.lives; l++) {
        var lx = 14 + l * 24;
        var ly = 14;
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(lx + 8, ly - 6);
        ctx.lineTo(lx + 2, ly + 3);
        ctx.lineTo(lx + 4, ly);
        ctx.lineTo(lx + 2, ly - 3);
        ctx.closePath();
        ctx.stroke();
      }
    }
  });
})();
