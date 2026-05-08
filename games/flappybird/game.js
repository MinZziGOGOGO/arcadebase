// FLAPPYBIRD — ArcadeBase
// 300×500 canvas, gravity bird, scrolling pipes, tap to flap

(function() {
  const BIRD_X = 80;
  const BIRD_R = 30;
  const GRAVITY = 800;
  const FLAP_VEL = -350;
  const PIPE_W = 60;
  const PIPE_GAP = 150;
  const PIPE_SPEED = 150;
  const PIPE_SPACING = 200;
  const GROUND_H = 50;
  const MAX_ROTATION = Math.PI / 4;  // 45° nose-down max
  const FLAP_ROTATION = -Math.PI / 6; // -30° nose-up on flap

  const BIRD_COLORS = ['#ffbe0b', '#ff006e', '#00f0ff', '#39ff14', '#8338ec'];
  let birdColorIdx = Math.floor(Math.random() * BIRD_COLORS.length);

  const game = GameBase.create({
    container: document.getElementById('game-container'),
    canvasW: 300,
    canvasH: 500,
    gameKey: 'flappybird',
    helpText: 'Tap anywhere to flap upward\\nFly through pipe gaps to score\\nAvoid hitting pipes, ground, or ceiling\\nEach pipe passed = 1 point',
    helpTitle: 'FLAPPY BIRD RULES',

    // ── Init: touch & keyboard handlers ──
    init(canvas, ctx) {
      const self = this;

      // Touch — tap to flap
      self._onTouch = (e) => {
        e.preventDefault();
        self._flap();
      };
      canvas.addEventListener('touchstart', self._onTouch, { passive: false });

      // Mouse click = flap
      self._onClick = (e) => {
        self._flap();
      };
      canvas.addEventListener('click', self._onClick);

      // Keyboard: space/up to flap
      self._onKey = (e) => {
        if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
          e.preventDefault();
          self._flap();
        }
      };
      window.addEventListener('keydown', self._onKey);
    },

    // ── Title screen ──
    start() {
      this._showOverlay('FLAPPY BIRD', 'Tap to flap!', null, 'START');
    },

    // ── Reset for new game ──
    restart() {
      this.bird = {
        y: this.canvas.height / 2 - 50,
        vy: 0,
        rotation: 0,
        alive: true,
      };
      this.pipes = [];
      this._pipeTimer = 0;
      this._groundOffset = 0;
      this._started = false;
      this._birdFlashTimer = 0;
    },

    // ── Flap action ──
    _flap() {
      if (this.state === 'playing') {
        if (!this._started) {
          this._started = true;
        }
        if (this.bird.alive) {
          this.bird.vy = FLAP_VEL;
          this.bird.rotation = FLAP_ROTATION;
        }
      }
    },

    // ── Spawn a pipe pair ──
    _spawnPipe() {
      const canvas = this.canvas;
      const minPipeY = 60;           // minimum top of gap
      const maxPipeY = canvas.height - GROUND_H - PIPE_GAP - 60; // maximum top of gap
      const gapTop = minPipeY + Math.random() * (maxPipeY - minPipeY);

      this.pipes.push({
        x: canvas.width,
        gapTop: gapTop,
        gapBottom: gapTop + PIPE_GAP,
        width: PIPE_W,
        scored: false,
      });
    },

    // ── Per-frame update ──
    update(dt) {
      const canvas = this.canvas;
      const bird = this.bird;

      if (!bird.alive) {
        // Count down flash delay, then trigger game over
        this._birdFlashTimer -= dt;
        if (this._birdFlashTimer <= 0) {
          this._birdFlashTimer = 0;
          this.gameOver();
        }
        // Still scroll ground
        this._groundOffset = (this._groundOffset + PIPE_SPEED * dt) % 40;
        return;
      }

      // Physics only after first flap
      if (this._started) {
        // Gravity
        bird.vy += GRAVITY * dt;
        bird.y += bird.vy * dt;

        // Rotate bird: -30° when flapping, up to +45° when falling fast
        const targetRotation = bird.vy > 0
          ? Math.min(bird.vy / 600, 1.0) * MAX_ROTATION
          : FLAP_ROTATION;
        bird.rotation += (targetRotation - bird.rotation) * Math.min(dt * 8, 1.0);

        // Floor and ceiling collision
        if (bird.y + BIRD_R >= canvas.height - GROUND_H) {
          bird.y = canvas.height - GROUND_H - BIRD_R;
          bird.alive = false;
          bird.vy = 0;
          this._startGameOver();
          return;
        }
        if (bird.y - BIRD_R <= 0) {
          bird.y = BIRD_R;
          bird.vy = 0;
          bird.alive = false;
          this._startGameOver();
          return;
        }

        // Spawn pipes
        this._pipeTimer += dt;
        if (this._pipeTimer >= PIPE_SPACING / PIPE_SPEED) {
          this._pipeTimer = 0;
          this._spawnPipe();
        }

        // Move pipes left
        for (const pipe of this.pipes) {
          pipe.x -= PIPE_SPEED * dt;
        }

        // Remove off-screen pipes
        this.pipes = this.pipes.filter(p => p.x + p.width > -20);

        // Scoring and collision
        for (const pipe of this.pipes) {
          // Score when bird passes the center of the pipe
          const pipeCenterX = pipe.x + pipe.width / 2;
          if (!pipe.scored && bird.x > pipeCenterX) {
            pipe.scored = true;
            this.addScore(1);
          }

          // Bird-pipe collision (AABB + circle)
          if (
            bird.x + BIRD_R > pipe.x &&
            bird.x - BIRD_R < pipe.x + pipe.width
          ) {
            // Check top pipe
            if (bird.y - BIRD_R < pipe.gapTop) {
              bird.alive = false;
              this._startGameOver();
              return;
            }
            // Check bottom pipe
            if (bird.y + BIRD_R > pipe.gapBottom) {
              bird.alive = false;
              this._startGameOver();
              return;
            }
          }
        }
      }

      // Ground scroll
      this._groundOffset = (this._groundOffset + PIPE_SPEED * dt) % 40;
    },

    _startGameOver() {
      // Brief flash delay before showing overlay
      this._birdFlashTimer = 0.8; // seconds
    },

    // ── Render ──
    draw(ctx) {
      const canvas = this.canvas;

      // Sky gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height - GROUND_H);
      skyGrad.addColorStop(0, '#1a1a3e');
      skyGrad.addColorStop(0.6, '#16213e');
      skyGrad.addColorStop(1, '#0f3460');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height - GROUND_H);

      // Stars (static dots in background)
      ctx.fillStyle = '#ffffff22';
      const stars = [[40, 60], [120, 30], [200, 90], [260, 50], [70, 140],
        [150, 120], [240, 180], [100, 200], [30, 250], [190, 230]];
      for (const [sx, sy] of stars) {
        ctx.fillRect(sx, sy, 2, 2);
      }

      // ── Pipes ──
      const bird = this.bird;
      for (const pipe of this.pipes) {
        const topH = pipe.gapTop;
        const botY = pipe.gapBottom;
        const botH = canvas.height - GROUND_H - botY;

        // Top pipe
        this._drawPipe(ctx, pipe.x, 0, pipe.width, topH, false);
        // Bottom pipe
        this._drawPipe(ctx, pipe.x, botY, pipe.width, botH, true);
      }

      // ── Bird ──
      const bColor = BIRD_COLORS[birdColorIdx];
      ctx.save();
      ctx.translate(BIRD_X, bird.y);
      ctx.rotate(bird.rotation);

      // Body
      ctx.fillStyle = bColor;
      ctx.shadowColor = bColor;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Wing
      const wingWave = Math.sin(Date.now() / 150) * 4;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-8, 4 + wingWave, 12, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Eye
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(10, -6, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(12, -6, 5, 0, Math.PI * 2);
      ctx.fill();

      // Beak
      ctx.fillStyle = '#ffbe0b';
      ctx.beginPath();
      ctx.moveTo(25, 0);
      ctx.lineTo(36, -4);
      ctx.lineTo(36, 4);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      // ── Ground ──
      ctx.fillStyle = '#2d6a1e';
      ctx.fillRect(0, canvas.height - GROUND_H, canvas.width, GROUND_H);

      // Ground stripe pattern
      ctx.fillStyle = '#3d8a2e';
      for (let gx = -this._groundOffset; gx < canvas.width; gx += 40) {
        ctx.fillRect(gx, canvas.height - GROUND_H + 10, 20, 3);
      }
      for (let gx = -this._groundOffset + 20; gx < canvas.width; gx += 40) {
        ctx.fillRect(gx, canvas.height - GROUND_H + 25, 20, 3);
      }

      // Ground top edge highlight
      ctx.strokeStyle = '#4daa3e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height - GROUND_H);
      ctx.lineTo(canvas.width, canvas.height - GROUND_H);
      ctx.stroke();

      // ── Bird-alive check for gameover delay ──
      if (!bird.alive && this._birdFlashTimer !== undefined) {
        // Don't draw anything extra — gameover overlay will show
      }

      // ── "Tap to start" hint ──
      if (!this._started && bird.alive) {
        const alpha = 0.5 + Math.sin(Date.now() / 400) * 0.3;
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.font = '8px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('TAP TO FLY', canvas.width / 2, canvas.height / 2 + 30);
      }
    },

    _drawPipe(ctx, x, y, w, h, isBottom) {
      // Pipe body
      ctx.fillStyle = '#39ff14';
      ctx.shadowColor = '#39ff14';
      ctx.shadowBlur = 6;
      ctx.fillRect(x + 4, y, w - 8, h);
      ctx.shadowBlur = 0;

      // Pipe edge highlights
      ctx.fillStyle = '#66ff44';
      ctx.fillRect(x + 4, y, 4, h);       // left highlight
      ctx.fillStyle = '#22cc00';
      ctx.fillRect(x + w - 8, y, 4, h);   // right shadow

      // Cap (wider part on the gap side)
      const capY = isBottom ? y : y + h - 16;
      ctx.fillStyle = '#39ff14';
      ctx.fillRect(x, capY, w, 16);
      ctx.fillStyle = '#66ff44';
      ctx.fillRect(x, capY, 4, 16);       // left highlight
      ctx.fillStyle = '#22cc00';
      ctx.fillRect(x + w - 4, capY, 4, 16); // right shadow
    },
  });
})();
