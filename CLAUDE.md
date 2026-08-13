# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

Tetris en JavaScript vanilla + HTML5 Canvas. Sin `package.json`, sin bundler, sin transpilador, sin tests, sin linter. 3 archivos: `index.html`, `style.css`, `game.js`.

## Ejecutar

```bash
start index.html          # Windows, abrir directo
python3 -m http.server 8000   # o servidor estático (npx serve . / php -S localhost:8000)
```

No hay build ni test que ejecutar. Verificación = abrir en navegador y jugar.

## Arquitectura (`game.js`)

Un único script global, `'use strict'`, sin módulos. Estructura por capas:

- **Estado global mutable**: `board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId`. Todo se reinicia en `init()`, que también actúa como handler del botón de reinicio.
- **Tablero**: matriz `ROWS × COLS` de enteros; `0` = vacío, `1–7` = índice en `COLORS`/`PIECES`. El mismo índice codifica tipo de pieza y color, por eso `PIECES[n]` está rellena con el valor `n` (no con `1`).
- **Piezas**: matrices cuadradas. Rotación = `rotateCW` (transposición + reverso). `tryRotate` aplica wall kicks probando desplazamientos `[0,-1,1,-2,2]`.
- **Colisión**: `collide(shape, ox, oy)` es la única primitiva de validación; movimiento, rotación, ghost y bloqueo pasan todos por ella. Permite `ny < 0` (spawn parcialmente fuera por arriba).
- **Ciclo de vida de la pieza**: `spawn()` → input/gravedad → `lockPiece()` (= `merge` + `clearLines` + `spawn`). `spawn()` detecta game over si la pieza nueva ya colisiona.
- **Game loop**: `loop(ts)` con `requestAnimationFrame`, acumulador `dropAccum` contra `dropInterval`. La pausa cancela el `animId` y **resetea `lastTime`** al reanudar para no arrastrar el delta acumulado.
- **Render**: `draw()` repinta todo cada frame (grid → tablero → ghost con `alpha 0.2` → pieza actual). `drawBlock` es compartido por el canvas del tablero y el de la vista previa, parametrizado por `context` y `size`.

## Restricciones al modificar

- `COLS`, `ROWS` y `BLOCK` deben coincidir con `width`/`height` del `<canvas id="board">` en `index.html` (`COLS × BLOCK` y `ROWS × BLOCK`).
- `drawNext` centra la pieza en una rejilla fija de 4×4; si cambia el tamaño de `#next-canvas`, ajustar `NB` y los offsets.
- Los IDs del DOM se cachean al cargar el script (`getElementById` en el top level): cualquier ID nuevo en `index.html` requiere su constante en `game.js`.
- Texto de UI en español (overlay, botón); comentarios y README también en español.
