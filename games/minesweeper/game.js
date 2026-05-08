// MINESWEEPER — ArcadeBase
// Touch-optimized with difficulty selection, timer, and high score (best time)

(function() {
  const DIFFICULTIES = {
    easy:   { grid: 9,  mines: 10, label: '9×9',   cell: 36 },
    medium: { grid: 16, mines: 40, label: '16×16', cell: 22 },
    hard:   { grid: 16, mines: 99, label: '16×30', cell: 16, cols: 30 },
  };

  let diff, GRID, MINES, COLS, CELL, gridW, gridH;
  let board, revealed, flagged, mineCount, started, startTime, flagMode;
  let game; // assigned after GameBase.create returns

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function applyDifficulty(key) {
    diff = DIFFICULTIES[key];
    GRID  = diff.grid;
    MINES = diff.mines;
    COLS  = diff.cols || GRID;
    CELL  = diff.cell;
    gridW = COLS * CELL;
    gridH = GRID * CELL;
  }
  applyDifficulty('easy');

  const CANVAS_W = 500, CANVAS_H = 420;

  initBoard(); // initialize board state before the game loop starts

  game = GameBase.create({
    container: document.getElementById('canvas-wrapper'),
    canvasW: CANVAS_W, canvasH: CANVAS_H,
    gameKey: 'minesweeper',
    helpText: 'Tap to reveal, long-press to flag\\nNumbers show adjacent mines\\nClear all safe cells to win\\nScore based on speed',
    helpTitle: 'MINESWEEPER RULES',

    init(canvas, ctx) {
      let pressTimer = null;
      let pressCell = null;

      // --- Touch: tap to reveal, long-press (500ms) to flag ---
      canvas.addEventListener('touchstart', e => {
        if (game.state !== 'playing' || game.paused) return;
        const cell = touchToCell(canvas, e);
        if (!cell) return;
        pressCell = cell;
        pressTimer = setTimeout(() => {
          if (pressCell) toggleFlag(pressCell.c, pressCell.r);
          pressTimer = null; pressCell = null;
        }, 500);
        e.preventDefault();
      }, { passive: false });

      canvas.addEventListener('touchend', e => {
        if (game.state !== 'playing' || game.paused) return;
        if (pressTimer) {
          clearTimeout(pressTimer); pressTimer = null;
          if (pressCell) revealCell(pressCell.c, pressCell.r);
        }
        pressCell = null;
        e.preventDefault();
      }, { passive: false });

      canvas.addEventListener('touchmove', () => {
        if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; pressCell = null; }
      });

      // --- Desktop click for flag-mode ---
      canvas.addEventListener('click', e => {
        if (!flagMode) return;
        const cell = mouseToCell(canvas, e);
        if (cell) toggleFlag(cell.c, cell.r);
      });

      // --- Flag toggle button ---
      const hud = this._hud;
      const flagBtn = document.createElement('button');
      flagBtn.id = 'flag-btn';
      flagBtn.className = 'btn gold';
      flagBtn.textContent = '🚩 FLAG';
      flagBtn.style.cssText = 'margin-left:8px;font-size:8px;min-width:80px';
      const pauseBtn = hud.querySelector('#pause-btn');
      if (pauseBtn) pauseBtn.insertAdjacentElement('afterend', flagBtn);

      flagBtn.addEventListener('click', () => {
        flagMode = !flagMode;
        flagBtn.textContent = flagMode ? '🚩 FLAG ON' : '🚩 FLAG';
        flagBtn.className = flagMode ? 'btn btn-pink' : 'btn gold';
      });
      flagBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        flagMode = !flagMode;
        flagBtn.textContent = flagMode ? '🚩 FLAG ON' : '🚩 FLAG';
        flagBtn.className = flagMode ? 'btn btn-pink' : 'btn gold';
      }, { passive: false });
    },

    start() {
      this.state = 'title';
      showTitle(this);
    },

    restart() {
      initBoard();
    },

    update(dt) {
      if (started && this.state === 'playing' && !this.paused) startTime += dt;
    },

    draw(ctx) {
      const ox = Math.floor((CANVAS_W - gridW) / 2);

      // Background
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < COLS; c++) {
          const x = ox + c * CELL, y = r * CELL;
          if (revealed[r] && revealed[r][c]) {
            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(x, y, CELL, CELL);
            if (board[r][c] === -1) {
              ctx.fillStyle = '#ff006e';
              ctx.beginPath();
              ctx.arc(x + CELL/2, y + CELL/2, CELL * 0.35, 0, Math.PI * 2);
              ctx.fill();
            } else if (board[r][c] > 0) {
              const colors = ['','#2196F3','#39ff14','#ff006e','#8338ec','#ffbe0b','#00f0ff','#888','#444'];
              ctx.fillStyle = colors[board[r][c]];
              const fs = CELL < 20 ? CELL * 0.55 : 14;
              ctx.font = `${fs}px "Press Start 2P"`;
              ctx.textAlign = 'center';
              ctx.fillText(board[r][c], x + CELL/2, y + CELL/2 + fs * 0.35);
            }
          } else {
            ctx.fillStyle = '#2a2a4e';
            ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
            ctx.strokeStyle = '#3a3a5e';
            ctx.strokeRect(x, y, CELL, CELL);
            if (flagged[r] && flagged[r][c]) {
              ctx.fillStyle = '#ffbe0b';
              const fs = CELL < 20 ? CELL * 0.7 : 14;
              ctx.font = `${fs}px "Press Start 2P"`;
              ctx.textAlign = 'center';
              ctx.fillText('🚩', x + CELL/2, y + CELL/2 + fs * 0.3);
            }
          }
        }
      }

      // Info bar (mine count + timer)
      const barY = gridH + 4;
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(ox, barY, gridW, 36);
      ctx.fillStyle = '#ffbe0b';
      ctx.font = '10px "Press Start 2P"';
      ctx.textAlign = 'left';
      ctx.fillText('💣' + mineCount, ox + 8, barY + 24);
      ctx.textAlign = 'right';
      const secs = Math.floor(startTime);
      ctx.fillText('⏱' + secs, ox + gridW - 8, barY + 24);
    }
  });

  // ── coordinate conversion ────────────────────────────────────

  function touchToCell(canvas, e) {
    const p = Utils.getCanvasPos(canvas, e);
    if (!p) return null;
    const ox = Math.floor((CANVAS_W - gridW) / 2);
    const c = Math.floor((p.x - ox) / CELL);
    const r = Math.floor(p.y / CELL);
    if (r < 0 || r >= GRID || c < 0 || c >= COLS) return null;
    return { c, r };
  }

  function mouseToCell(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top)  * scaleY;
    const ox = Math.floor((CANVAS_W - gridW) / 2);
    const c = Math.floor((cx - ox) / CELL);
    const r = Math.floor(cy / CELL);
    if (r < 0 || r >= GRID || c < 0 || c >= COLS) return null;
    return { c, r };
  }

  // ── board logic ──────────────────────────────────────────────

  function initBoard() {
    board = []; revealed = []; flagged = [];
    for (let r = 0; r < GRID; r++) {
      board[r]    = Array(COLS).fill(0);
      revealed[r] = Array(COLS).fill(false);
      flagged[r]  = Array(COLS).fill(false);
    }
    mineCount = MINES; started = false; startTime = 0; flagMode = false;
  }

  function placeMines(excludeR, excludeC) {
    const exclude = new Set();
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const nr = excludeR + dr, nc = excludeC + dc;
        if (nr >= 0 && nr < GRID && nc >= 0 && nc < COLS)
          exclude.add(nr * COLS + nc);
      }

    let placed = 0;
    const maxAttempts = MINES * 20;
    let attempts = 0;
    while (placed < MINES && attempts < maxAttempts) {
      const r = randInt(0, GRID - 1), c = randInt(0, COLS - 1);
      if (board[r][c] !== -1 && !exclude.has(r * COLS + c)) {
        board[r][c] = -1; placed++;
      }
      attempts++;
    }

    while (placed < MINES) {
      const r = randInt(0, GRID - 1), c = randInt(0, COLS - 1);
      if (board[r][c] !== -1) { board[r][c] = -1; placed++; }
    }

    for (let r = 0; r < GRID; r++)
      for (let c = 0; c < COLS; c++)
        if (board[r][c] !== -1)
          board[r][c] = countAdjacent(r, c);
  }

  function countAdjacent(r, c) {
    let count = 0;
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < GRID && nc >= 0 && nc < COLS && board[nr][nc] === -1)
          count++;
      }
    return count;
  }

  function revealCell(c, r) {
    if (r < 0 || r >= GRID || c < 0 || c >= COLS) return;
    if (revealed[r] && revealed[r][c]) return;
    if (flagged[r] && flagged[r][c]) return;
    if (game.state !== 'playing' || game.paused) return;

    if (!started) {
      started = true; startTime = 0;
      placeMines(r, c);
    }

    revealed[r][c] = true;

    if (board[r][c] === -1) {
      for (let rr = 0; rr < GRID; rr++)
        for (let cc = 0; cc < COLS; cc++)
          if (board[rr][cc] === -1) revealed[rr][cc] = true;

      game.gameOver();
      const sub = game._overlay.querySelector('#ov-sub');
      if (sub) sub.textContent = 'Time: ' + Math.floor(startTime) + 's';
      return;
    }

    if (board[r][c] === 0) {
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++)
          revealCell(c + dc, r + dr);
    }

    checkWin();
  }

  function toggleFlag(c, r) {
    if (r < 0 || r >= GRID || c < 0 || c >= COLS) return;
    if (revealed[r] && revealed[r][c]) return;
    if (game.state !== 'playing' || game.paused) return;
    if (flagged[r][c]) { flagged[r][c] = false; mineCount++; }
    else if (mineCount > 0) { flagged[r][c] = true; mineCount--; }
  }

  function checkWin() {
    let unrevealed = 0;
    for (let r = 0; r < GRID; r++)
      for (let c = 0; c < COLS; c++)
        if (!revealed[r][c] && board[r][c] !== -1) unrevealed++;

    if (unrevealed === 0) {
      const time = Math.floor(startTime);
      const score = Math.max(0, 10000 - time * 10);
      game.addScore(score);

      const prevBest = Utils.loadHighScore('minesweeper');
      const isNewBest = score > prevBest;
      if (isNewBest) {
        game.highScore = score;
        Utils.saveHighScore('minesweeper', score);
      }

      game.state = 'gameover';
      game.showOverlay(
        'YOU WIN! 🎉',
        isNewBest ? '🏆 NEW BEST!' : 'Previous best: ' + formatTime(prevBest),
        score,
        'PLAY AGAIN'
      );
    }
  }

  // ── screens ──────────────────────────────────────────────────

  function showTitle(g) {
    g.showOverlay('💣 MINESWEEPER', '', '', '');
    const overlay = g._overlay;
    const sub  = overlay.querySelector('#ov-sub');
    const btn  = overlay.querySelector('#ov-btn');

    overlay.querySelectorAll('.diff-group').forEach(el => el.remove());

    sub.textContent = 'CHOOSE DIFFICULTY';
    btn.style.display = 'none';

    const group = document.createElement('div');
    group.className = 'diff-group';
    group.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-top:8px';
    group.innerHTML = 
      '<button class="btn btn-cyan diff-btn" data-diff="easy">🟢 EASY 9×9</button>' +
      '<button class="btn btn-gold diff-btn" data-diff="medium">🟡 MED 16×16</button>' +
      '<button class="btn btn-pink diff-btn" data-diff="hard">🔴 HARD 16×30</button>';
    const bestEl = document.createElement('div');
    bestEl.className = 'overlay-best';
    bestEl.style.marginTop = '8px';
    bestEl.textContent = 'BEST: ' + formatTime(Utils.loadHighScore('minesweeper'));
    group.appendChild(bestEl);

    sub.insertAdjacentElement('afterend', group);

    group.querySelectorAll('.diff-btn').forEach(b => {
      b.addEventListener('click', () => {
        applyDifficulty(b.dataset.diff);
        initBoard();
        g.startGame();
      });
    });
  }

  function formatTime(score) {
    if (score <= 0) return '--';
    const t = Math.round((10000 - score) / 10);
    return t + 's';
  }
})();
