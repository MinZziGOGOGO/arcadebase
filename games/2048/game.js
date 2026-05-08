// 2048 — ArcadeBase

(function () {
  var GRID = 4;
  var CELL = 80;
  var GAP = 16;
  var ANIM_SPEED = 6; // animation duration factor (higher = faster)

  // Tile colors
  var COLORS = {
    2:    {bg: '#eee4da', fg: '#776e65'},
    4:    {bg: '#ede0c8', fg: '#776e65'},
    8:    {bg: '#f2b179', fg: '#f9f6f2'},
    16:   {bg: '#f59563', fg: '#f9f6f2'},
    32:   {bg: '#f67c5f', fg: '#f9f6f2'},
    64:   {bg: '#f65e3b', fg: '#f9f6f2'},
    128:  {bg: '#edcf72', fg: '#f9f6f2'},
    256:  {bg: '#edcc61', fg: '#f9f6f2'},
    512:  {bg: '#edc850', fg: '#f9f6f2'},
    1024: {bg: '#edc53f', fg: '#f9f6f2'},
    2048: {bg: '#edc22e', fg: '#f9f6f2'},
  };

  function tileColor(val) {
    return COLORS[val] || {bg: '#3c3a32', fg: '#f9f6f2'};
  }

  function cx(c) { return GAP + c * (CELL + GAP); }
  function cy(r) { return GAP + r * (CELL + GAP); }

  var DIRS = {
    up:    {dr: -1, dc:  0},
    down:  {dr:  1, dc:  0},
    left:  {dr:  0, dc: -1},
    right: {dr:  0, dc:  1},
  };

  // Compute slide result for a direction, returns animation entries
  function slide(grid, dir) {
    var entries = []; // {value, oldR, oldC, newR, newC, merged}

    if (dir.dr !== 0) {
      // Vertical
      for (var c = 0; c < GRID; c++) {
        var line = [];
        var rStart = dir.dr === 1 ? GRID - 1 : 0;
        var rEnd   = dir.dr === 1 ? -1 : GRID;
        var rStep  = dir.dr === 1 ? -1 : 1;

        for (var r = rStart; r !== rEnd; r += rStep) {
          if (grid[r][c].value !== 0) {
            line.push({value: grid[r][c].value, oldR: r, oldC: c});
          }
        }

        var merged = [];
        for (var i = 0; i < line.length; i++) {
          if (i < line.length - 1 && line[i].value === line[i + 1].value) {
            merged.push({value: line[i].value * 2, oldR: line[i + 1].oldR, oldC: line[i + 1].oldC, merged: true});
            i++;
          } else {
            merged.push({value: line[i].value, oldR: line[i].oldR, oldC: line[i].oldC, merged: false});
          }
        }

        var newR = rStart;
        for (var j = 0; j < merged.length; j++) {
          merged[j].newR = newR;
          merged[j].newC = c;
          entries.push(merged[j]);
          newR += rStep;
        }
      }
    } else {
      // Horizontal
      for (var r = 0; r < GRID; r++) {
        var line = [];
        var cStart = dir.dc === 1 ? GRID - 1 : 0;
        var cEnd   = dir.dc === 1 ? -1 : GRID;
        var cStep  = dir.dc === 1 ? -1 : 1;

        for (var c = cStart; c !== cEnd; c += cStep) {
          if (grid[r][c].value !== 0) {
            line.push({value: grid[r][c].value, oldR: r, oldC: c});
          }
        }

        var merged = [];
        for (var i = 0; i < line.length; i++) {
          if (i < line.length - 1 && line[i].value === line[i + 1].value) {
            merged.push({value: line[i].value * 2, oldR: line[i + 1].oldR, oldC: line[i + 1].oldC, merged: true});
            i++;
          } else {
            merged.push({value: line[i].value, oldR: line[i].oldR, oldC: line[i].oldC, merged: false});
          }
        }

        var newC = cStart;
        for (var j = 0; j < merged.length; j++) {
          merged[j].newR = r;
          merged[j].newC = newC;
          entries.push(merged[j]);
          newC += cStep;
        }
      }
    }

    return entries;
  }

  function hasMoves(grid) {
    for (var r = 0; r < GRID; r++) {
      for (var c = 0; c < GRID; c++) {
        if (grid[r][c].value === 0) return true;
        if (c < GRID - 1 && grid[r][c].value === grid[r][c + 1].value) return true;
        if (r < GRID - 1 && grid[r][c].value === grid[r + 1][c].value) return true;
      }
    }
    return false;
  }

  function emptyCells(grid) {
    var list = [];
    for (var r = 0; r < GRID; r++)
      for (var c = 0; c < GRID; c++)
        if (grid[r][c].value === 0) list.push({r: r, c: c});
    return list;
  }

  function spawnTile(grid) {
    var cells = emptyCells(grid);
    if (cells.length === 0) return {r: -1, c: -1, value: 0};
    var pos = cells[Math.floor(Math.random() * cells.length)];
    var val = Math.random() < 0.9 ? 2 : 4;
    grid[pos.r][pos.c] = {value: val, merged: false};
    return {r: pos.r, c: pos.c, value: val};
  }

  function initGrid() {
    var g = [];
    for (var r = 0; r < GRID; r++) {
      g[r] = [];
      for (var c = 0; c < GRID; c++) g[r][c] = {value: 0, merged: false};
    }
    spawnTile(g);
    spawnTile(g);
    return g;
  }

  // ──────────────────────────────────────────

  var game = GameBase.create({
    container: document.getElementById('canvas-wrapper'),
    canvasW: 400,
    canvasH: 400,
    gameKey: '2048',
    helpText: 'Swipe to move all tiles\\nMatching numbers combine into sum\\nReach 2048 to win\\nNew tiles spawn after each move',
    helpTitle: '2048 RULES',

    init: function (canvas, ctx) {
      var self = this;

      this.grid        = initGrid();
      this.animEntries = null;
      this.animProgress = 0;
      this.animating    = false;
      this.wonBefore    = false;  // won at least once, continuing

      // ── Input ──────────────────────────

      function tryMove(dirName) {
        if (self.state !== 'playing' || self.paused || self.animating) return;
        var dir = DIRS[dirName];
        if (!dir) return;
        var entries = slide(self.grid, dir);

        // Check if anything changed
        var moved = false;
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].oldR !== entries[i].newR || entries[i].oldC !== entries[i].newC) moved = true;
          if (entries[i].merged) moved = true;
        }
        if (!moved) return;

        // Score from merges
        for (var j = 0; j < entries.length; j++) {
          if (entries[j].merged) self.addScore(entries[j].value);
        }

        self.animEntries = entries;
        self.animProgress = 0;
        self.animating = true;
      }

      // Swipe
      Utils.createSwipeDetector(canvas, {
        onSwipe: function (dir) { if (self.state === 'playing' && !self.paused) tryMove(dir); },
      });

      // D-pad
      [['dpad-up', 'up'], ['dpad-down', 'down'], ['dpad-left', 'left'], ['dpad-right', 'right']]
        .forEach(function (pair) {
          var btn = document.getElementById(pair[0]);
          if (!btn) return;
          (function (dir) {
            function handler(e) { e.preventDefault(); tryMove(dir); }
            btn.addEventListener('click', handler);
            btn.addEventListener('touchstart', handler, {passive: false});
          })(pair[1]);
        });

      // Keyboard
      var km = {ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right'};
      this._keyHandler = function (e) {
        var d = km[e.key];
        if (d) { e.preventDefault(); tryMove(d); }
      };
      window.addEventListener('keydown', this._keyHandler);
    },

    start: function () {
      this.state = 'title';
      this.showOverlay('2048', 'Swipe to merge tiles', '', 'START');
      this.grid = initGrid();
      this.wonBefore = false;
    },

    restart: function () {
      this.grid = initGrid();
      this.animEntries = null;
      this.animProgress = 0;
      this.animating = false;
      this.wonBefore = false;
    },

    update: function (dt) {
      if (!this.animating) return;

      this.animProgress += dt * ANIM_SPEED;
      if (this.animProgress >= 1) {
        this.animProgress = 1;
        this.animating = false;

        // Commit new grid
        for (var r = 0; r < GRID; r++)
          for (var c = 0; c < GRID; c++)
            this.grid[r][c] = {value: 0, merged: false};

        for (var i = 0; i < this.animEntries.length; i++) {
          var e = this.animEntries[i];
          this.grid[e.newR][e.newC] = {value: e.value, merged: e.merged};
        }

        // Check for 2048 win (only trigger once)
        var reached2048 = false;
        for (var rr = 0; rr < GRID; rr++)
          for (var cc = 0; cc < GRID; cc++)
            if (this.grid[rr][cc].value >= 2048) reached2048 = true;

        if (reached2048 && !this.wonBefore) {
          this.wonBefore = true;
          var keep = this;
          this.showOverlay('YOU WIN!', 'Continue?', this.score, 'CONTINUE');
          this.state = 'paused_overlay';
          // Override the overlay button to continue
          document.getElementById('ov-btn').onclick = function () {
            keep.state = 'playing';
            keep.hideOverlay();
            keep._lastTime = 0;
            keep.updateHUD();
          };
          return;
        }

        // Spawn new tile
        var spawn = spawnTile(this.grid);
        this.animEntries = null;

        // Check lose
        if (!hasMoves(this.grid)) {
          this.gameOver();
        }
      }
    },

    draw: function (ctx) {
      var w = this.canvas.width, h = this.canvas.height;

      // Background
      ctx.fillStyle = '#bbada0';
      ctx.fillRect(0, 0, w, h);

      // Empty cells
      ctx.fillStyle = 'rgba(238,228,218,0.35)';
      for (var r = 0; r < GRID; r++) {
        for (var c = 0; c < GRID; c++) {
          var x = cx(c), y = cy(r);
          ctx.fillRect(x, y, CELL, CELL);
        }
      }

      // Draw tiles
      if (this.animating && this.animEntries) {
        // Animated tiles — lerp from old to new
        var t = this.animProgress;
        // Ease-out
        var et = 1 - Math.pow(1 - t, 3);
        for (var i = 0; i < this.animEntries.length; i++) {
          var e = this.animEntries[i];
          var ox = cx(e.oldC), oy = cy(e.oldR);
          var nx = cx(e.newC), ny = cy(e.newR);
          var dx = ox + (nx - ox) * et;
          var dy = oy + (ny - oy) * et;
          drawTile(ctx, dx, dy, CELL, e.value, e.merged && t > 0.6);
        }
      } else {
        // Static grid
        for (var r = 0; r < GRID; r++) {
          for (var c = 0; c < GRID; c++) {
            if (this.grid[r][c].value !== 0) {
              drawTile(ctx, cx(c), cy(r), CELL, this.grid[r][c].value, false);
            }
          }
        }
      }
    },
  });

  function drawTile(ctx, x, y, size, value, pop) {
    var c = tileColor(value);

    // Background
    ctx.fillStyle = c.bg;
    ctx.fillRect(x, y, size, size);

    // Pop effect for merged tiles
    if (pop) {
      var s = 1.12;
      var dx = size * (1 - s) / 2, dy = size * (1 - s) / 2;
      ctx.fillStyle = c.bg;
      ctx.fillRect(x + dx, y + dy, size * s, size * s);
    }

    // Text
    ctx.fillStyle = c.fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    var fontSize;
    if (value < 100) fontSize = 24;
    else if (value < 1000) fontSize = 20;
    else if (value < 10000) fontSize = 16;
    else fontSize = 12;

    ctx.font = 'bold ' + fontSize + 'px "Press Start 2P", monospace';
    ctx.fillText(String(value), x + size / 2, y + size / 2 + 2);
  }
})();
