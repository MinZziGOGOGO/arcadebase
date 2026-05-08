// BREAKOUT — ArcadeBase
// 400×500 canvas, 8×6 brick grid, touch-drag paddle, 3 lives

(function() {
  const BRICK_ROWS = 6;
  const BRICK_COLS = 8;
  const BRICK_W = 44;
  const BRICK_H = 20;
  const BRICK_GAP_X = 4;
  const BRICK_GAP_Y = 4;
  const BRICK_OFFSET_X = 16;
  const BRICK_OFFSET_Y = 50;
  const PADDLE_W = 80;
  const PADDLE_H = 12;
  const PADDLE_Y = 460;
  const BALL_R = 6;
  const BALL_SPEED = 320;
  const MAX_ANGLE = (60 * Math.PI) / 180;
  const PADDLE_KEY_SPEED = 400;
  const TAP_THRESHOLD = 10; // px — max movement to count as tap

  // Row configs — top to bottom (DESIGN.md: red/orange/gold/green/cyan/blue)
  const ROW_COLORS = [
    { fill: '#ff006e', highlight: '#ff4488', points: 70, hp: 2 }, // red (silver)
    { fill: '#ff6b00', highlight: '#ff9944', points: 60, hp: 2 }, // orange (gold)
    { fill: '#ffbe0b', highlight: '#ffd60a', points: 50, hp: 1 }, // gold
    { fill: '#39ff14', highlight: '#66ff44', points: 40, hp: 1 }, // green
    { fill: '#00f0ff', highlight: '#66ffff', points: 30, hp: 1 }, // cyan
    { fill: '#4361ee', highlight: '#6688ff', points: 20, hp: 1 }, // blue
  ];

  const game = GameBase.create({
    container: document.getElementById('game-container'),
    canvasW: 400,
    canvasH: 500,
    gameKey: 'breakout',
    helpText: 'Destroy all bricks to advance\\nDrag paddle to move, tap to launch ball\\nTop 2 rows take 2 hits each\\nSpeed increases as you clear bricks',
    helpTitle: 'BREAKOUT RULES',

    // ── Init: input handlers ──
    init(canvas, ctx) {
      const self = this;
      self._keys = {};
      self._touchStart = null; // { x, y, time } for tap detection

      self._keyDown = (e) => {
        self._keys[e.key] = true;
      };
      self._keyUp = (e) => {
        self._keys[e.key] = false;
      };
      window.addEventListener('keydown', self._keyDown);
      window.addEventListener('keyup', self._keyUp);

      // Touch drag — move paddle
      self._onTouchStart = (e) => {
        if (self.state !== 'playing') return;
        e.preventDefault();
        const t = e.touches[0];
        self._touchStart = { x: t.clientX, y: t.clientY, time: Date.now() };
        // Also begin paddle tracking immediately
        const pos = Utils.getCanvasPos(canvas, e);
        if (pos) {
          self.paddle.x = Utils.clamp(
            pos.x - PADDLE_W / 2, 0, canvas.width - PADDLE_W
          );
        }
      };

      self._onTouchMove = (e) => {
        if (self.state !== 'playing') return;
        e.preventDefault();
        const pos = Utils.getCanvasPos(canvas, e);
        if (pos) {
          self.paddle.x = Utils.clamp(
            pos.x - PADDLE_W / 2, 0, canvas.width - PADDLE_W
          );
        }
      };

      // Launch ball on quick tap (short duration, minimal movement)
      self._onTouchEnd = (e) => {
        if (self.state !== 'playing') return;
        e.preventDefault();
        if (!self.ballAttached) return;
        if (!self._touchStart) return;

        const t = e.changedTouches[0];
        const dx = t.clientX - self._touchStart.x;
        const dy = t.clientY - self._touchStart.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const dt = Date.now() - self._touchStart.time;

        if (dist < TAP_THRESHOLD && dt < 300) {
          self._launchBall();
        }
      };

      canvas.addEventListener('touchstart', self._onTouchStart, { passive: false });
      canvas.addEventListener('touchmove', self._onTouchMove, { passive: false });
      canvas.addEventListener('touchend', self._onTouchEnd, { passive: false });

      // Mouse: drag paddle + click to launch (desktop)
      self._onMouseMove = (e) => {
        if (e.buttons !== 1) return;
        e.preventDefault();
        const pos = Utils.getCanvasPos(canvas, e);
        if (pos) {
          self.paddle.x = Utils.clamp(
            pos.x - PADDLE_W / 2, 0, canvas.width - PADDLE_W
          );
        }
      };

      self._onClick = (e) => {
        if (self.state === 'playing' && self.ballAttached) {
          self._launchBall();
        }
      };

      canvas.addEventListener('mousemove', self._onMouseMove);
      canvas.addEventListener('click', self._onClick);
    },

    // ── Start game ──
    start: function() {
      this.restart();
      this.showOverlay('BREAKOUT', 'Classic brick breaker', null, 'START');
      this.state = 'title';
    },

    // ── Reset for new game ──
    restart() {
      this.lives = 3;
      this.ballAttached = true;
      this.bricksRemaining = BRICK_ROWS * BRICK_COLS;
      this.level = 1;
      this.ballSpeed = BALL_SPEED;

      this.paddle = {
        x: (this.canvas.width - PADDLE_W) / 2,
        y: PADDLE_Y,
        w: PADDLE_W,
        h: PADDLE_H,
      };

      this.ball = {
        x: this.paddle.x + PADDLE_W / 2,
        y: this.paddle.y - BALL_R,
        r: BALL_R,
        vx: 0,
        vy: 0,
      };

      this._createBricks();
    },

    _createBricks() {
      this.bricks = [];
      for (let row = 0; row < BRICK_ROWS; row++) {
        for (let col = 0; col < BRICK_COLS; col++) {
          this.bricks.push({
            x: BRICK_OFFSET_X + col * (BRICK_W + BRICK_GAP_X),
            y: BRICK_OFFSET_Y + row * (BRICK_H + BRICK_GAP_Y),
            w: BRICK_W,
            h: BRICK_H,
            hp: ROW_COLORS[row].hp,
            maxHp: ROW_COLORS[row].hp,
            color: ROW_COLORS[row],
            alive: true,
          });
        }
      }
    },

    // ── Launch ball from paddle ──
    _launchBall() {
      const angle = Utils.rand(-MAX_ANGLE * 0.5, MAX_ANGLE * 0.5);
      this.ball.vx = Math.sin(angle) * this.ballSpeed;
      this.ball.vy = -Math.cos(angle) * this.ballSpeed;
      this.ballAttached = false;
    },

    _resetBall() {
      this.ballAttached = true;
      this.ball.x = this.paddle.x + PADDLE_W / 2;
      this.ball.y = this.paddle.y - BALL_R;
      this.ball.vx = 0;
      this.ball.vy = 0;
    },

    // ── Per-frame update ──
    update(dt) {
      const canvas = this.canvas;
      const paddle = this.paddle;

      // Keyboard paddle
      if (this._keys['ArrowLeft'] || this._keys['a'] || this._keys['A']) {
        paddle.x = Utils.clamp(
          paddle.x - PADDLE_KEY_SPEED * dt, 0, canvas.width - PADDLE_W
        );
      }
      if (this._keys['ArrowRight'] || this._keys['d'] || this._keys['D']) {
        paddle.x = Utils.clamp(
          paddle.x + PADDLE_KEY_SPEED * dt, 0, canvas.width - PADDLE_W
        );
      }
      // Space / Enter to launch
      if ((this._keys[' '] || this._keys['Enter']) && this.ballAttached) {
        this._launchBall();
        this._keys[' '] = false;
        this._keys['Enter'] = false;
      }

      if (this.ballAttached) {
        this.ball.x = paddle.x + PADDLE_W / 2;
        this.ball.y = paddle.y - BALL_R;
        return;
      }

      const ball = this.ball;

      // Move
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      // Left/right walls
      if (ball.x - ball.r <= 0) {
        ball.x = ball.r;
        ball.vx = Math.abs(ball.vx);
      }
      if (ball.x + ball.r >= canvas.width) {
        ball.x = canvas.width - ball.r;
        ball.vx = -Math.abs(ball.vx);
      }

      // Top wall
      if (ball.y - ball.r <= 0) {
        ball.y = ball.r;
        ball.vy = Math.abs(ball.vy);
      }

      // Bottom — lose a life
      if (ball.y + ball.r >= canvas.height) {
        this.lives--;
        this.ballSpeed = BALL_SPEED; // reset speed
        if (this.lives <= 0) {
          this.gameOver();
        } else {
          this._resetBall();
        }
        return;
      }

      // Paddle collision
      this._checkPaddle();

      // Brick collisions
      this._checkBricks();
    },

    // ── Paddle bounce with angle based on hit position ──
    _checkPaddle() {
      const ball = this.ball;
      const p = this.paddle;

      if (ball.vy <= 0) return; // ball moving up

      const ballBottom = ball.y + ball.r;
      const ballPrevBottom = ballBottom - ball.vy * 0.017;

      if (
        ballBottom >= p.y &&
        ballPrevBottom <= p.y + p.h &&
        ball.x + ball.r > p.x &&
        ball.x - ball.r < p.x + p.w
      ) {
        // Hit position: -1 (left edge) .. +1 (right edge)
        const hitPos = (ball.x - (p.x + p.w / 2)) / (p.w / 2);
        const angle = Utils.clamp(hitPos, -1, 1) * MAX_ANGLE;
        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        ball.vx = Math.sin(angle) * speed;
        ball.vy = -Math.cos(angle) * speed;
        ball.y = p.y - ball.r;
      }
    },

    // ── Brick collision: resolve on axis with least overlap ──
    _checkBricks() {
      const ball = this.ball;

      for (const brick of this.bricks) {
        if (!brick.alive) continue;

        const ol = ball.x + ball.r - brick.x;
        const or = brick.x + brick.w - (ball.x - ball.r);
        const ot = ball.y + ball.r - brick.y;
        const ob = brick.y + brick.h - (ball.y - ball.r);

        if (ol > 0 && or > 0 && ot > 0 && ob > 0) {
          // Reflect on axis with least overlap
          const minX = Math.min(ol, or);
          const minY = Math.min(ot, ob);

          if (minX < minY) {
            ball.vx = -ball.vx;
            ball.x += ol < or ? -ol : or;
          } else {
            ball.vy = -ball.vy;
            ball.y += ot < ob ? -ot : ob;
          }

          // Damage brick
          brick.hp--;
          if (brick.hp <= 0) {
            brick.alive = false;
            this.bricksRemaining--;
            this.addScore(brick.color.points);

            // Slight speed boost per brick cleared
            this.ballSpeed += 2;

            // All bricks cleared?
            if (this.bricksRemaining <= 0) {
              this.addScore(500); // clear bonus
              this.level++;
              this.ballSpeed = BALL_SPEED + (this.level - 1) * 20;
              this._createBricks();
              this.bricksRemaining = BRICK_ROWS * BRICK_COLS;
              this._resetBall();
            }
          }
          break; // one brick per frame
        }
      }
    },

    // ── Render ──
    draw(ctx) {
      const canvas = this.canvas;
      if (!this.paddle) return;

      // Background
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Divider line below HUD area
      ctx.strokeStyle = '#00f0ff22';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 37);
      ctx.lineTo(canvas.width, 37);
      ctx.stroke();

      // ── Ghost piece (where ball would land) ──
      if (!this.ballAttached) {
        this._drawGhost(ctx);
      }

      // ── Bricks ──
      for (const brick of this.bricks) {
        if (!brick.alive) continue;

        const alpha = 0.4 + (brick.hp / brick.maxHp) * 0.6;
        ctx.globalAlpha = alpha;

        ctx.fillStyle = brick.color.fill;
        ctx.fillRect(brick.x, brick.y, brick.w, brick.h);

        // Top highlight
        ctx.fillStyle = brick.color.highlight;
        ctx.fillRect(brick.x, brick.y, brick.w, 3);

        // Outline
        ctx.strokeStyle = '#00000055';
        ctx.lineWidth = 1;
        ctx.strokeRect(brick.x, brick.y, brick.w, brick.h);

        ctx.globalAlpha = 1;
      }

      // ── Paddle ──
      const p = this.paddle;
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 10;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#66ffff';
      ctx.fillRect(p.x, p.y, p.w, 3);

      // ── Ball ──
      const ball = this.ball;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // ── Lives (top right) ──
      for (let i = 0; i < this.lives - 1; i++) {
        const lx = canvas.width - 20 - i * 22;
        ctx.fillStyle = '#ffbe0b';
        ctx.beginPath();
        ctx.arc(lx, 18, 6, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── Level + brick count (top left) ──
      ctx.fillStyle = '#888';
      ctx.font = '8px "Press Start 2P"';
      ctx.textAlign = 'left';
      ctx.fillText('LV ' + this.level, 10, 15);
      ctx.fillText('■' + this.bricksRemaining, 10, 30);

      // ── "Tap to launch" hint ──
      if (this.ballAttached) {
        ctx.fillStyle = '#ffffff66';
        ctx.font = '6px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('TAP TO LAUNCH', canvas.width / 2, p.y - 20);
      }
    },

    // ── Ghost piece: translucent ball at drop position ──
    _drawGhost(ctx) {
      const ball = this.ball;
      let gy = ball.y;

      // Simulate dropping straight down
      while (gy + ball.r < this.canvas.height) {
        // Check brick collision at this Y
        let hitBrick = false;
        for (const brick of this.bricks) {
          if (!brick.alive) continue;
          if (
            ball.x + ball.r > brick.x &&
            ball.x - ball.r < brick.x + brick.w &&
            gy + ball.r > brick.y &&
            gy - ball.r < brick.y + brick.h
          ) {
            gy = brick.y - ball.r;
            hitBrick = true;
            break;
          }
        }
        if (hitBrick) break;

        // Check paddle
        if (
          gy + ball.r >= this.paddle.y &&
          ball.x + ball.r > this.paddle.x &&
          ball.x - ball.r < this.paddle.x + this.paddle.w
        ) {
          gy = this.paddle.y - ball.r;
          break;
        }

        gy += 4; // step down
        if (gy + ball.r >= this.canvas.height) {
          gy = this.canvas.height - ball.r;
          break;
        }
      }

      // Draw ghost
      ctx.fillStyle = '#ffffff22';
      ctx.beginPath();
      ctx.arc(ball.x, gy, ball.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff44';
      ctx.lineWidth = 1;
      ctx.stroke();
    },
  });
})();
