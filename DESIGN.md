# ArcadeBase — Design Document

> Mobile-first retro game collection. 10 games, vanilla JS, no frameworks.

## Mobile Touch Controls — Best Practices

### Touch Event Strategy
- Use **touch events** (touchstart, touchmove, touchend) over pointer events for broader mobile compatibility
- All game canvas elements get `touch-action: none` + `user-select: none` CSS
- All touch handlers use `{ passive: false }` so `preventDefault()` works — this stops scroll, zoom, and long-press context menus during gameplay
- Viewport meta: `<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">`

### Control Schemes Per Game Type
| Game Type | Primary Control | Fallback |
|-----------|----------------|----------|
| Directional (Snake, Pac-Man, 2048) | Swipe gestures | On-screen D-pad buttons |
| Continuous drag (Pong, Breakout) | Touch-drag on canvas half | — |
| Tap-only (Flappy Bird) | Tap anywhere | — |
| Multi-action (Tetris, Asteroids, Space Invaders) | Swipe + tap combo | On-screen button cluster |
| Grid tap (Minesweeper) | Tap + long-press (500ms) | Flag toggle button |

### Swipe Detection
- Threshold: 30px minimum distance, < 300ms for tap detection
- Direction computed from atan2 of delta — 45° sectors
- Shared in `shared/utils.js` as `Utils.createSwipeDetector()`

### Canvas Responsive Sizing
- Each game defines logical dimensions (e.g., 300×600 for Tetris)
- CSS scales canvas to fit screen: `min(maxW / logicalW, maxH / logicalH, 1.0)`
- Canvas `width`/`height` attributes stay at logical size; only CSS `style.width`/`style.height` changes
- Resize handler is debounced via rAF; orientationchange triggers immediate resize after 100ms delay
- No devicePixelRatio scaling needed — logical pixels are small enough to be crisp, and CSS scaling handles it

### Minimum Touch Targets
- All buttons: min 44×44px (Apple HIG)
- Virtual D-pad buttons: 48×48px minimum
- Pause/restart buttons: 44×44px minimum

---

## Shared Architecture

### File Structure
```
arcadebase/
├── index.html           # Landing page: 10 game cards, neon grid
├── shared/
│   ├── styles.css       # CSS variables, dark theme, button styles, overlays
│   ├── utils.js         # Touch helpers, canvas setup, localStorage, math
│   └── game-base.js     # Game loop factory, pause, score, HUD, overlays
├── games/
│   ├── tetris/{index.html,game.js,style.css}
│   ├── snake/{index.html,game.js,style.css}
│   ├── pong/{index.html,game.js,style.css}
│   ├── breakout/{index.html,game.js,style.css}
│   ├── minesweeper/{index.html,game.js,style.css}
│   ├── flappybird/{index.html,game.js,style.css}
│   ├── 2048/{index.html,game.js,style.css}
│   ├── spaceinvaders/{index.html,game.js,style.css}
│   ├── pacman/{index.html,game.js,style.css}
│   └── asteroids/{index.html,game.js,style.css}
├── assets/fonts/        # Press Start 2P via Google Fonts CDN
├── server.py            # Python http.server on :8090
└── DESIGN.md            # This file
```

### Color Palette (CSS Variables)
- `--bg-dark: #0a0a0a` — page background
- `--bg-panel: #1a1a2e` — card/panel background
- `--neon-cyan: #00f0ff` — primary accent, borders, title
- `--neon-pink: #ff006e` — secondary accent, danger, pause
- `--neon-gold: #ffbe0b` — score, highlights
- `--neon-purple: #8338ec` — high score, special
- `--neon-green: #39ff14` — success states
- `--text-light: #e0e0e0` — body text
- `--text-dim: #888` — secondary text

### Font
- Google Fonts: "Press Start 2P" — loaded via @import in shared/styles.css
- 8px pixel font, aliased rendering

### High Score Convention
- localStorage keys: `arcadebase_<gamekey>` (e.g., `arcadebase_tetris`, `arcadebase_snake`)
- Functions: `Utils.loadHighScore(key)`, `Utils.saveHighScore(key, score)`

### Game Base (game-base.js)
- Factory: `GameBase.create({ container, canvasW, canvasH, gameKey, init, update, draw, restart, start })`
- Manages: canvas setup, responsive resize, rAF game loop, pause toggle (Escape/p key + button), score tracking, high score auto-save, title/gameover overlay with restart button, HUD bar (score, best, pause button)
- State machine: `title → playing → gameover` (with `paused_overlay` as transient state)

---

## Game-by-Game Design

### 1. Tetris
- **Canvas:** 300×600 (portrait 1:2)
- **Game Key:** `tetris`
- **Grid:** 10 columns × 20 rows (30px cells)
- **Pieces:** 7 tetrominoes (I,O,T,S,Z,J,L) — neon colors: cyan, gold, purple, green, red, blue, orange
- **Rotation:** SRS-style — try offset on wall kick (shift left/right up to 2 cells)
- **Ghost piece:** Semi-transparent preview at drop position
- **Levels:** Speed increases every 10 lines. Drop interval: 1000ms at level 1, decreasing by 75ms/level, min 100ms
- **Scoring:** 100/300/500/800 for 1/2/3/4 lines
- **Touch controls:** Swipe left/right → move; swipe down → hard drop; tap → rotate CW; on-screen buttons (← ↓ → ↻) as fallback
- **Next piece:** Preview in corner of canvas

### 2. Snake
- **Canvas:** 400×400 (square)
- **Game Key:** `snake`
- **Grid:** 20×20 cells (20px each)
- **Mechanics:** Snake moves in grid steps. Food spawns randomly (not on body). Eating grows tail. Wall collision = death (no wrap).
- **Speed:** 150ms per step, decreasing 2ms per food eaten, min 60ms
- **Scoring:** 10 points per food
- **Touch controls:** Swipe in desired direction (can't reverse 180°). On-screen D-pad fallback.

### 3. Pong vs AI
- **Canvas:** 400×300 (4:3 landscape-ish)
- **Game Key:** `pong`
- **Mechanics:** Player paddle (left, 80px tall), AI paddle (right). Ball reflects off paddles and top/bottom walls. Ball speed increases 5% each hit.
- **AI:** Tracks ball Y with 0.85 accuracy factor + random jitter ±15px. Reaction delay: 3-5 frames.
- **Win condition:** First to 7 points
- **Scoring:** 1 point per goal against AI. High score = fewest AI points allowed.
- **Touch:** Drag finger on left half of canvas to move paddle. Paddle Y = touch Y.

### 4. Breakout
- **Canvas:** 400×500
- **Game Key:** `breakout`
- **Bricks:** 8 columns × 6 rows. Row colors: red (70pts), orange (60), gold (50), green (40), cyan (30), blue (20). Top 2 rows take 2 hits (silver/gold).
- **Paddle:** 80px wide at bottom. Ball launches on tap/click, angle based on hit position.
- **Lives:** 3. Ball reset on death.
- **Touch:** Drag paddle horizontally anywhere on canvas.

### 5. Minesweeper
- **Canvas:** 360×400
- **Game Key:** `minesweeper`
- **Grid:** 9×9 with 10 mines (easy). Cell size: 36px.
- **Mechanics:** Tap to reveal. Long-press (500ms) or flag-toggle button to flag. Recursive flood fill on 0-cells.
- **UI:** Mine counter (flags remaining), timer since first click.
- **Touch:** Tap = reveal, long-press or flag-mode toggle = place/remove flag.

### 6. Flappy Bird
- **Canvas:** 300×500 (portrait)
- **Game Key:** `flappybird`
- **Mechanics:** Bird (30px radius) with gravity 800px/s². Flap = -350px/s upward velocity. Pipes (60px wide, 150px gap) scroll at 150px/s from right. Ground at bottom 50px.
- **Scoring:** 1 point per pipe passed (count when bird passes pipe center)
- **Touch:** Tap anywhere to flap.

### 7. 2048
- **Canvas:** 400×400 (square)
- **Game Key:** `2048`
- **Grid:** 4×4, cells 90px each with 6px gaps
- **Mechanics:** Swipe to move all tiles. Matching tiles merge (2+2=4, 4+4=8...). New 2 (90%) or 4 (10%) spawns after each valid move.
- **Win:** Reach 2048 (continue option). Lose: no valid moves.
- **Tile colors:** 2=#eee4da, 4=#ede0c8, 8=#f2b179, 16=#f59563, 32=#f67c5f, 64=#f65e3b, 128=#edcf72, 256=#edcc61, 512=#edc850, 1024=#edc53f, 2048=#edc22e
- **Touch:** Swipe gestures. Arrow button fallback.
- **Animation:** Tile sliding via canvas draw (interpolate position over 100ms)

### 8. Space Invaders
- **Canvas:** 400×500
- **Game Key:** `spaceinvaders`
- **Aliens:** 5 rows × 10 columns. Row types (bottom to top): squid(10pts), crab(20pts), octopus(40pts), squid, crab.
- **Formation:** Moves side-to-side, drops one row when hitting edge. Speed increases as aliens are destroyed.
- **Player:** Ship at bottom, moves left/right, fires upward. 1 bullet at a time.
- **Barriers:** 3 defensive barriers that degrade on hits.
- **Mothership:** Appears every 25-35 seconds across top. Random bonus: 50/100/150/200/300 points.
- **Lives:** 3
- **Touch:** Drag ship on bottom third of canvas. Tap top two-thirds to shoot. Dedicated fire button as fallback.

### 9. Pac-Man
- **Canvas:** 400×440
- **Game Key:** `pacman`
- **Maze:** 15×15 tile grid (26px tiles). Simplified maze with corridors and 4 power pellet corners.
- **Pac-Man:** Moves through corridors, eats dots (10pts) and power pellets (50pts). Mouth animation: open/close cycle.
- **Ghosts:** 4 ghosts with AI modes cycling every 7s/20s/7s/20s/5s/5s... (chase/scatter alternating, scatter periods shorten):
  - **Blinky (red):** Targets Pac-Man's current tile
  - **Pinky (pink):** Targets 4 tiles ahead of Pac-Man
  - **Inky (cyan):** Complex — targets double the vector from Blinky to 2 tiles ahead of Pac-Man
  - **Clyde (orange):** Targets Pac-Man if far (>8 tiles), scatter corner if close (<8 tiles)
- **Frightened:** Power pellet → 8 seconds, ghosts flee (random directions), turn blue. Eating ghost: 200/400/800/1600 (doubles per ghost).
- **Lives:** 3. Extra life at 10,000.
- **Touch:** Swipe on left half for direction. Virtual joystick area.

### 10. Asteroids
- **Canvas:** 400×400 (square)
- **Game Key:** `asteroids`
- **Ship:** Triangle, 20px scale. Rotation 5°/frame. Thrust 0.1px/frame. Friction 0.99. Max velocity 6px/frame. Wrap-around.
- **Asteroids:** 3 sizes — large (r=50, 20pts), medium (r=25, 50pts), small (r=12, 100pts). Procedural jagged shapes (8-12 vertices). Splits into 2 on destroy. Rotate slowly.
- **UFOs:** Large (r=20, 200pts, every 25s) shoots randomly. Small (r=12, 1000pts, every 10s) aims at player.
- **Bullets:** Ship fires up to 4 at once. UFO bullets track toward player (small UFO).
- **Lives:** 3. Invulnerability 2s on respawn (flashing). Extra life at 10,000.
- **Collision:** Circle-circle for bullets/bullets. Circle-polygon (SAT + point-in-poly) for ship-asteroid.
- **Touch:** On-screen buttons: ↺ ↻ ▲ 🔫 (rotate left, rotate right, thrust, fire). Two-button layout — left side: rotation buttons stacked vertically, right side: thrust + fire buttons.
- **Reuse:** Physics and mechanics ported from `~/projects/retro-asteroids/` Pygame project.

---

## Landing Page (index.html)
- Grid of 10 game cards (2-3 columns on mobile, 4-5 on desktop)
- Each card: dark panel with neon border, game icon emoji, game name, subtle glow on hover/tap
- Cards link to `games/<name>/index.html`
- Title: "ARCADEBASE" in neon cyan, subtitle in dim text

## Server (server.py)
```python
import http.server
import socketserver

PORT = 8090
Handler = http.server.SimpleHTTPRequestHandler

with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
    print(f"ArcadeBase running on http://0.0.0.0:{PORT}")
    httpd.serve_forever()
```
Run from project root. Serves all static files.

---

## Implementation Order
1. Shared files (styles.css, utils.js, game-base.js)
2. Landing page (index.html)
3. Games in order: Tetris → Snake → Pong → Breakout → Minesweeper → Flappy Bird → 2048 → Space Invaders → Pac-Man → Asteroids
4. Integration: test all games, fix issues
5. Review
6. Git push + deploy on :8090
