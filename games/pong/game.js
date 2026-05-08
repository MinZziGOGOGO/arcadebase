// PONG — ArcadeBase
// Standalone player vs AI. First to 7 wins. Touch: drag left half of canvas.

(function() {
  var WIN_SCORE = 7;
  var PADDLE_W = 10;
  var PADDLE_H = 80;
  var BALL_R = 6;
  var BASE_SPEED = 200;
  var container = document.getElementById('canvas-wrapper');

  // Setup canvas
  var canvas = document.createElement('canvas');
  canvas.className = 'game-canvas';
  canvas.width = 400;
  canvas.height = 300;
  canvas.style.width = '400px';
  canvas.style.height = '300px';
  container.appendChild(canvas);
  var ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // Game state
  var state = 'title'; // title | playing | paused | gameover
  var score = 0;
  var aiScore = 0;
  var bestDefense = (function() {
    var v = localStorage.getItem('arcadebase_pong_best');
    return v ? parseInt(v, 10) : WIN_SCORE;
  })();

  // Paddles
  var playerY, aiY;

  // Ball
  var ballX, ballY, ballVX, ballVY, ballSpeed;

  // AI
  var aiTargetY, aiDelay, aiAccuracy, hitCount;

  // Touch
  var touchDown = false;

  function resetAll() {
    playerY = canvas.height / 2 - PADDLE_H / 2;
    aiY = canvas.height / 2 - PADDLE_H / 2;
    ballX = canvas.width / 2;
    ballY = canvas.height / 2;
    ballSpeed = BASE_SPEED;
    aiScore = 0;
    aiTargetY = canvas.height / 2;
    aiDelay = 0;
    aiAccuracy = 0.85;
    hitCount = 0;
    score = 0;
    launchBall();
  }

  function launchBall() {
    var angle = (Math.random() - 0.5) * (Math.PI / 3);
    ballVX = -Math.cos(angle) * ballSpeed;
    ballVY =  Math.sin(angle) * ballSpeed;
  }

  // Overlay
  var overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML =
    '<h2 class="overlay-title" id="ol-title"></h2>' +
    '<div class="overlay-score" id="ol-score"></div>' +
    '<div class="overlay-subtitle" id="ol-sub"></div>' +
    '<button class="btn btn-gold" id="ol-btn">START</button>';
  container.appendChild(overlay);

  function showOverlay(title, sub, scoreText, btnText) {
    overlay.classList.remove('hidden');
    document.getElementById('ol-title').textContent = title;
    document.getElementById('ol-sub').textContent = sub || '';
    document.getElementById('ol-score').textContent = scoreText || '';
    document.getElementById('ol-btn').textContent = btnText || 'START';
  }

  function hideOverlay() {
    overlay.classList.add('hidden');
  }

  document.getElementById('ol-btn').addEventListener('click', function() {
    if (state === 'title' || state === 'gameover') {
      resetAll();
      state = 'playing';
      hideOverlay();
    }
  });

  // HUD
  var hud = document.createElement('div');
  hud.className = 'hud-bar';
  hud.innerHTML =
    '<span style="flex:2;text-align:center;"><span class="score-label">YOU: </span><span class="score-value" id="hud-score">0</span>' +
    '  <span class="score-label">AI: </span><span class="score-value" id="hud-ais" style="color:#ff006e">0</span></span>' +
    '<span style="flex:1;text-align:center;"><span class="score-label">DEF: </span><span class="best-value" id="hud-best">' + bestDefense + '</span></span>' +
    '<button class="btn btn-pink" id="pause-btn">⏸</button>';
  container.appendChild(hud);

  document.getElementById('pause-btn').addEventListener('click', function() {
    if (state === 'playing') {
      state = 'paused';
      showOverlay('PAUSED', '', null, 'RESUME');
      // Override resume behavior
      document.getElementById('ol-btn').onclick = function() {
        state = 'playing';
        hideOverlay();
        document.getElementById('ol-btn').onclick = startBtnHandler;
      };
    }
  });

  var startBtnHandler = function() {
    if (state === 'title' || state === 'gameover') {
      resetAll();
      state = 'playing';
      hideOverlay();
    }
  };

  // Touch
  function getPos(e) {
    var rect = canvas.getBoundingClientRect();
    var sx = canvas.width / rect.width;
    var sy = canvas.height / rect.height;
    var cx = e.touches ? e.touches[0].clientX : e.clientX;
    var cy = e.touches ? e.touches[0].clientY : e.clientY;
    if (cx == null) return null;
    return {x: (cx - rect.left) * sx, y: (cy - rect.top) * sy};
  }

  canvas.addEventListener('touchstart', function(e) {
    if (state !== 'playing') return;
    e.preventDefault();
    var p = getPos(e);
    if (p && p.x < canvas.width / 2) {
      touchDown = true;
      playerY = p.y - PADDLE_H / 2;
    }
  }, {passive: false});

  canvas.addEventListener('touchmove', function(e) {
    if (state !== 'playing') return;
    e.preventDefault();
    if (!touchDown) return;
    var p = getPos(e);
    if (p && p.x < canvas.width / 2) {
      playerY = p.y - PADDLE_H / 2;
    }
  }, {passive: false});

  canvas.addEventListener('touchend', function(e) {
    if (state !== 'playing') return;
    e.preventDefault();
    touchDown = false;
  }, {passive: false});

  canvas.addEventListener('mousedown', function(e) {
    if (state !== 'playing') return;
    var p = getPos(e);
    if (p && p.x < canvas.width / 2) {
      touchDown = true;
      playerY = p.y - PADDLE_H / 2;
    }
  });

  canvas.addEventListener('mousemove', function(e) {
    if (!touchDown) return;
    var p = getPos(e);
    if (!p) return;
    if (p.x < canvas.width / 2) {
      playerY = p.y - PADDLE_H / 2;
    }
    if (!e.touches && p.x >= canvas.width / 2) {
      touchDown = false;
    }
  });

  canvas.addEventListener('mouseup', function() {
    touchDown = false;
  });

  // Resize
  function doResize() {
    var maxW = window.innerWidth - 16;
    var maxH = window.innerHeight - 120;
    var scale = Math.min(maxW / canvas.width, maxH / canvas.height, 1.0);
    canvas.style.width = Math.floor(canvas.width * scale) + 'px';
    canvas.style.height = Math.floor(canvas.height * scale) + 'px';
  }
  window.addEventListener('resize', function() { requestAnimationFrame(doResize); });
  window.addEventListener('orientationchange', function() { setTimeout(doResize, 100); });
  doResize();

  // Keyboard
  window.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      if (state === 'playing') {
        state = 'paused';
        showOverlay('PAUSED', '', null, 'RESUME');
      } else if (state === 'paused') {
        state = 'playing';
        hideOverlay();
      }
    }
  });

  // Initialize
  resetAll();
  showOverlay('PONG', 'vs AI - drag left half', null, 'START');

  // Game loop
  var lastTime = 0;
  function loop(ts) {
    requestAnimationFrame(loop);
    if (!lastTime) lastTime = ts;
    var dt = Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;

    if (state === 'playing') {
      update(dt);
    }

    draw();
    updateHUD();
  }

  function update(dt) {
    var ch = canvas.height;
    var cw = canvas.width;

    // Clamp player
    if (playerY < 0) playerY = 0;
    if (playerY > ch - PADDLE_H) playerY = ch - PADDLE_H;

    // AI
    aiAccuracy = 0.85 + hitCount * 0.01;
    if (aiAccuracy > 0.95) aiAccuracy = 0.95;

    if (aiDelay <= 0) {
      var jitter = (Math.random() - 0.5) * 30;
      aiTargetY = ballY * aiAccuracy + (ch / 2) * (1 - aiAccuracy) + jitter;
      aiDelay = 3 + Math.floor(Math.random() * 3);
    }
    aiDelay--;

    var aiC = aiY + PADDLE_H / 2;
    var d = aiTargetY - aiC;
    var max = ballSpeed * 0.8 * dt;
    if (d > max) d = max; else if (d < -max) d = -max;
    aiY += d;
    if (aiY < 0) aiY = 0;
    if (aiY > ch - PADDLE_H) aiY = ch - PADDLE_H;

    // Ball
    ballX += ballVX * dt;
    ballY += ballVY * dt;

    // Walls
    if (ballY - BALL_R < 0) { ballY = BALL_R; ballVY = Math.abs(ballVY); }
    if (ballY + BALL_R > ch) { ballY = ch - BALL_R; ballVY = -Math.abs(ballVY); }

    // Player hit
    if (ballVX < 0 && ballX - BALL_R < 20 && ballX + BALL_R > 10 &&
        ballY + BALL_R > playerY && ballY - BALL_R < playerY + PADDLE_H) {
      ballX = 20 + BALL_R;
      ballSpeed *= 1.05;
      hitCount++;
      var hit = (ballY - (playerY + PADDLE_H / 2)) / (PADDLE_H / 2);
      var a = hit * (Math.PI / 2.5);
      ballVX =  Math.cos(a) * ballSpeed;
      ballVY =  Math.sin(a) * ballSpeed;
    }

    // AI hit
    var aix = cw - 20;
    if (ballVX > 0 && ballX + BALL_R > aix && ballX - BALL_R < aix + PADDLE_W &&
        ballY + BALL_R > aiY && ballY - BALL_R < aiY + PADDLE_H) {
      ballX = aix - BALL_R;
      ballSpeed *= 1.05;
      hitCount++;
      var hit2 = (ballY - (aiY + PADDLE_H / 2)) / (PADDLE_H / 2);
      var a2 = hit2 * (Math.PI / 2.5);
      ballVX = -Math.cos(a2) * ballSpeed;
      ballVY =  Math.sin(a2) * ballSpeed;
    }

    // Goals
    if (ballX + BALL_R < 0) {
      aiScore++;
      ballX = cw / 2; ballY = ch / 2; ballSpeed = BASE_SPEED;
      launchBall();
      if (aiScore >= WIN_SCORE) { endGame(); return; }
    }
    if (ballX - BALL_R > cw) {
      score++;
      ballX = cw / 2; ballY = ch / 2; ballSpeed = BASE_SPEED;
      launchBall();
      if (score >= WIN_SCORE) { endGame(); return; }
    }
  }

  function endGame() {
    state = 'gameover';
    if (aiScore < bestDefense) {
      bestDefense = aiScore;
      localStorage.setItem('arcadebase_pong_best', String(aiScore));
    }
    showOverlay('GAME OVER', 'YOU:' + score + '  AI:' + aiScore, null, 'RESTART');
  }

  function draw() {
    var w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);

    // Center line
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();
    ctx.setLineDash([]);

    // Paddles
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = 'rgba(0,240,255,0.5)';
    ctx.fillRect(10, playerY, PADDLE_W, PADDLE_H);

    ctx.fillStyle = '#ff006e';
    ctx.shadowColor = 'rgba(255,0,110,0.5)';
    ctx.fillRect(w - 10 - PADDLE_W, aiY, PADDLE_W, PADDLE_H);

    // Ball
    ctx.fillStyle = '#ffbe0b';
    ctx.shadowColor = 'rgba(255,190,11,0.6)';
    ctx.beginPath();
    ctx.arc(ballX, ballY, BALL_R, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
  }

  function updateHUD() {
    document.getElementById('hud-score').textContent = score;
    document.getElementById('hud-ais').textContent = aiScore;
    document.getElementById('hud-best').textContent = bestDefense;
  }

  requestAnimationFrame(loop);
})();
