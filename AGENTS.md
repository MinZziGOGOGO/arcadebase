# ArcadeBase — Agent Rules

> Learned from May 8, 2026 session: 3 games blocked for hours by protocol violations.
> These rules prevent recurrence.

## 1. Complexity estimation (always do this first)

Before creating any kanban task for game implementation:
- Estimate lines of code. If >400 lines → SPLIT.
- Count independent subsystems (rendering, logic, input, collision). If >3 → SPLIT.
- A full game is NEVER a single task.

## 2. Task splitting template

For any new game, use this pattern:

```
T1  backend-eng   game: [Name] — core logic + state management
T2  backend-eng   game: [Name] — rendering + HUD              (parent: T1)
T3  backend-eng   game: [Name] — input handling                (parent: T1)
T4  backend-eng   game: [Name] — collision + physics           (parent: T1)
T5  backend-eng   game: [Name] — integration                   (parents: T2,T3,T4)
```

Each subtask should be ~100-175 lines. This keeps workers from crashing.

## 3. Protocol violation recovery

If any task hits 2 protocol violations:
1. `hermes kanban reassign <id> backend-eng`
2. `hermes kanban unblock <id>` (if blocked)
3. DO NOT re-dispatch. Write the file directly with `write_file`.
4. `hermes kanban complete <id> --summary "..."` to preserve board state.

Do not retry the same approach more than twice.

## 4. Subagent fallback

If `delegate_task` subagents fail (API errors, timeouts):
- Write game files directly — do not loop.
- Bypassing broken dispatch is the right call, not a last resort.

## 5. Board hygiene

- Always complete kanban tasks after direct writes to preserve audit trail.
- Verify profiles with `hermes kanban assignees` before creating tasks.
- Check for phantom assignees (profiles with `on disk=no`).

## Project state (May 8, 2026)

- 10 games complete: tetris, snake, pong, breakout, minesweeper, flappybird, 2048, spaceinvaders, pacman, asteroids
- Server: `python3 -m http.server 8090` from project root
- All 27 kanban tasks done
- No blocked/stale tasks
