"use strict";

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  "#4dd0e1", // I - cyan
  "#ffd54f", // O - yellow
  "#ba68c8", // T - purple
  "#81c784", // S - green
  "#e57373", // Z - red
  "#90caf9", // J - azul pálido
  "#ffb74d", // L - orange
  "#cfd8dc", // comodín (Tinte)
  "#f06292", // + (Ataque matemático)
  "#78909c", // basura
];

const WILD = 8;
const PLUS = 9;
const GARBAGE = 10;

// ---- Modos de juego ----
const MODES = {
  NORMAL: "normal",
  TIME: "time",
  GARBAGE: "garbage",
  MATH: "math",
};
const MODE_NAMES = {
  normal: "Normal",
  time: "Tiempo",
  garbage: "Basura",
  math: "Ataque mat.",
};
const TIME_LIMIT_MS = 120000;
const TIME_TARGET_LINES = 40;
const GARBAGE_INTERVAL = 10000;
const PLUS_CHANCE = 0.05;

const POWERUP_CHANCE = 0.05;
const POWERUPS = [
  { id: "bomb", icon: "💣", name: "Bomba" },
  { id: "ray", icon: "⚡", name: "Rayo" },
  { id: "tint", icon: "🎨", name: "Tinte" },
  { id: "gravity", icon: "⬇️", name: "Gravedad" },
  { id: "freeze", icon: "❄️", name: "Congelar" },
];
const FREEZE_MS = 5000;

const PIECES = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  null, // 8 = comodín (Tinte), no es una pieza jugable
  [
    [0, 9, 0],
    [9, 9, 9],
    [0, 9, 0],
  ], // + (Ataque matemático)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const nextCanvas = document.getElementById("next-canvas");
const nextCtx = nextCanvas.getContext("2d");
const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayScore = document.getElementById("overlay-score");
const restartBtn = document.getElementById("restart-btn");
const powerIconEl = document.getElementById("power-icon");
const powerNameEl = document.getElementById("power-name");
const themeToggleBtn = document.getElementById("theme-toggle");
const menuEl = document.getElementById("menu");
const menuBtn = document.getElementById("menu-btn");
const modeNameEl = document.getElementById("mode-name");
const timeSection = document.getElementById("time-section");
const timeEl = document.getElementById("time");
const goalSection = document.getElementById("goal-section");
const goalEl = document.getElementById("goal");
const garbageSection = document.getElementById("garbage-section");
const garbageTimerEl = document.getElementById("garbage-timer");
const powerSection = document.getElementById("power-section");
const modeButtons = document.querySelectorAll(".mode-btn");
const menuHiscoresEl = document.getElementById("menu-hiscores");
const overlayHiscoresEl = document.getElementById("overlay-hiscores");
const hiscoreFormEl = document.getElementById("hiscore-form");
const hiscoreNameEl = document.getElementById("hiscore-name");
const hiscoreSaveBtn = document.getElementById("hiscore-save");
const clearHiscoresBtn = document.getElementById("clear-hiscores");

const THEME_KEY = "tetris-theme";
const HISCORES_KEY = "tetris-hiscores";
const HISCORES_MAX = 5;
const NAME_MAX = 12;
const DEFAULT_NAME = "ANON";

let board,
  current,
  next,
  score,
  lines,
  level,
  paused,
  gameOver,
  lastTime,
  dropAccum,
  dropInterval,
  animId,
  gridLineColor,
  armedPower,
  freezeMs,
  lastLockX,
  lastLockY,
  mode,
  timeLeftMs,
  garbageAccum,
  combo,
  maxCombo;

// índice de la fila recién insertada en la tabla de records (-1 = ninguna)
let newHiscoreIndex = -1;

// evita que la limpieza de líneas encadenada por Gravedad detone otro power-up
let firingPower = false;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type =
    mode === MODES.MATH && Math.random() < PLUS_CHANCE
      ? PLUS
      : Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length,
    cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every((v) => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  // El combo se actualiza aquí (y no en lockPiece) para que ya esté al día si
  // endGame("win") se dispara más abajo. `firingPower` evita que la limpieza
  // encadenada por Gravedad infle el combo, igual que con los power-ups.
  if (!firingPower) {
    if (cleared) {
      combo++;
      maxCombo = Math.max(maxCombo, combo);
    } else {
      combo = 0;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
    if (armedPower !== null && !firingPower) triggerPowerUp();
    if (mode === MODES.TIME && lines >= TIME_TARGET_LINES) endGame("win");
  }
  return cleared;
}

// ---- Modo Basura ----

function addGarbageRow() {
  if (board[0].some((v) => v !== 0)) {
    endGame();
    return;
  }
  board.shift();
  const row = new Array(COLS).fill(GARBAGE);
  row[Math.floor(Math.random() * COLS)] = 0;
  board.push(row);
  current.y--;
  if (collide(current.shape, current.x, current.y)) endGame();
}

// ---- Power-ups ----

function triggerPowerUp() {
  const power = POWERUPS[armedPower];
  armedPower = null;
  firingPower = true;
  switch (power.id) {
    case "bomb":
      powerBomb();
      break;
    case "ray":
      powerRay();
      break;
    case "tint":
      powerTint();
      break;
    case "gravity":
      powerGravity();
      break;
    case "freeze":
      powerFreeze();
      break;
  }
  firingPower = false;
  updatePowerHUD();
}

function powerBomb() {
  for (let r = lastLockY - 1; r <= lastLockY + 1; r++)
    for (let c = lastLockX - 1; c <= lastLockX + 1; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) board[r][c] = 0;
}

function powerRay() {
  for (let c = 0; c < COLS; c++) board[lastLockY][c] = 0;
  for (let r = 0; r < ROWS; r++) board[r][lastLockX] = 0;
}

function powerTint() {
  const counts = new Array(COLORS.length).fill(0);
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const v = board[r][c];
      if (v && v !== WILD) counts[v]++;
    }
  let best = 0;
  for (let i = 1; i < counts.length; i++) if (counts[i] > counts[best]) best = i;
  if (!best || !counts[best]) return;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) if (board[r][c] === best) board[r][c] = WILD;
}

function powerGravity() {
  for (let c = 0; c < COLS; c++) {
    let write = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r][c]) {
        board[write][c] = board[r][c];
        if (write !== r) board[r][c] = 0;
        write--;
      }
    }
    for (let r = write; r >= 0; r--) board[r][c] = 0;
  }
  clearLines();
}

function powerFreeze() {
  freezeMs = FREEZE_MS;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  recordLockCenter();
  merge();
  clearLines();
  spawn();
}

// centro de las celdas ocupadas de la pieza actual: objetivo de Bomba y Rayo
function recordLockCenter() {
  let minX = COLS,
    maxX = -1,
    minY = ROWS,
    maxY = -1;
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c]) {
        const x = current.x + c;
        const y = current.y + r;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
  lastLockX = clamp(Math.round((minX + maxX) / 2), 0, COLS - 1);
  lastLockY = clamp(Math.round((minY + maxY) / 2), 0, ROWS - 1);
}

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function spawn() {
  current = next;
  next = randomPiece();
  if (
    mode === MODES.NORMAL &&
    armedPower === null &&
    Math.random() < POWERUP_CHANCE
  ) {
    armedPower = Math.floor(Math.random() * POWERUPS.length);
    updatePowerHUD();
  }
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  if (mode === MODES.TIME) {
    timeEl.textContent = formatTime(timeLeftMs);
    goalEl.textContent = `${Math.min(lines, TIME_TARGET_LINES)}/${TIME_TARGET_LINES} líneas`;
  } else if (mode === MODES.GARBAGE) {
    const left = Math.max(0, GARBAGE_INTERVAL - garbageAccum);
    garbageTimerEl.textContent = `${Math.ceil(left / 1000)}s`;
  }
}

function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function applyModeUI() {
  modeNameEl.textContent = MODE_NAMES[mode];
  timeSection.classList.toggle("hidden", mode !== MODES.TIME);
  goalSection.classList.toggle("hidden", mode !== MODES.TIME);
  garbageSection.classList.toggle("hidden", mode !== MODES.GARBAGE);
  powerSection.classList.toggle("hidden", mode !== MODES.NORMAL);
}

function updatePowerHUD() {
  if (freezeMs > 0) {
    powerIconEl.textContent = "❄️";
    powerNameEl.textContent = `Congelado ${Math.ceil(freezeMs / 1000)}s`;
    return;
  }
  if (armedPower === null) {
    powerIconEl.textContent = "—";
    powerNameEl.textContent = "";
    return;
  }
  powerIconEl.textContent = POWERUPS[armedPower].icon;
  powerNameEl.textContent = POWERUPS[armedPower].name;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = "rgba(255,255,255,0.12)";
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  if (colorIndex === WILD) {
    // rombo central para distinguir el comodín
    const cx = x * size + size / 2;
    const cy = y * size + size / 2;
    const d = size * 0.18;
    context.fillStyle = "rgba(0,0,0,0.35)";
    context.beginPath();
    context.moveTo(cx, cy - d);
    context.lineTo(cx + d, cy);
    context.lineTo(cx, cy + d);
    context.lineTo(cx - d, cy);
    context.closePath();
    context.fill();
  }
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridLineColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  console.log(document.documentElement.getAttribute("data-theme"));
  themeToggleBtn.textContent = theme === "light" ? "🌙" : "☀️";
  gridLineColor = getComputedStyle(document.documentElement)
    .getPropertyValue("--grid-line")
    .trim();
}

function toggleTheme() {
  console.log("toggleTheme called");
  const current = document.documentElement.getAttribute("data-theme");
  const nextTheme = current === "light" ? "dark" : "light";
  localStorage.setItem(THEME_KEY, nextTheme);
  applyTheme(nextTheme);
}

// ---- Tabla de records ----

function sanitizeNumber(v) {
  return typeof v === "number" && Number.isFinite(v) && v >= 0
    ? Math.floor(v)
    : 0;
}

function sanitizeEntry(e) {
  if (!e || typeof e !== "object" || Array.isArray(e)) return null;
  if (typeof e.score !== "number" || !Number.isFinite(e.score)) return null;
  return {
    name: (typeof e.name === "string" ? e.name : DEFAULT_NAME).slice(
      0,
      NAME_MAX,
    ),
    score: sanitizeNumber(e.score),
    lines: sanitizeNumber(e.lines),
    combo: sanitizeNumber(e.combo),
    mode: typeof e.mode === "string" ? e.mode.slice(0, 20) : "",
    date: typeof e.date === "string" ? e.date : "",
  };
}

function loadHiscores() {
  let raw;
  try {
    raw = localStorage.getItem(HISCORES_KEY);
  } catch (err) {
    return [];
  }
  if (!raw) return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map(sanitizeEntry)
    .filter((e) => e !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, HISCORES_MAX);
}

function saveHiscores(list) {
  try {
    localStorage.setItem(HISCORES_KEY, JSON.stringify(list));
    return true;
  } catch (err) {
    // almacenamiento no disponible: los records no persisten
    return false;
  }
}

function qualifiesForHiscores(value) {
  if (value <= 0) return false;
  const list = loadHiscores();
  if (list.length < HISCORES_MAX) return true;
  return value > list[list.length - 1].score;
}

function buildHiscoreTable(list, highlight) {
  const table = document.createElement("table");
  table.className = "hiscore-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["#", "NOMBRE", "PTS", "LÍN", "COMBO"].forEach((text) => {
    const th = document.createElement("th");
    th.textContent = text;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  list.forEach((entry, i) => {
    const tr = document.createElement("tr");
    if (i === highlight) tr.classList.add("hiscore-new");

    const pos = document.createElement("td");
    pos.className = "hiscore-pos";
    pos.textContent = String(i + 1);

    const name = document.createElement("td");
    name.className = "hiscore-name";
    // textContent: el nombre lo escribe el usuario, nunca innerHTML
    name.textContent = entry.name || DEFAULT_NAME;
    if (entry.mode) {
      const modeSpan = document.createElement("span");
      modeSpan.className = "hiscore-mode";
      modeSpan.textContent = ` · ${entry.mode}`;
      name.appendChild(modeSpan);
    }

    const sc = document.createElement("td");
    sc.className = "hiscore-score";
    sc.textContent = entry.score.toLocaleString();

    const ln = document.createElement("td");
    ln.textContent = String(entry.lines);

    const cb = document.createElement("td");
    cb.textContent = String(entry.combo);

    tr.append(pos, name, sc, ln, cb);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
}

function renderHiscoresInto(container, list) {
  container.textContent = "";
  if (!list.length) {
    const p = document.createElement("p");
    p.className = "hiscore-empty";
    p.textContent = "Sin records todavía";
    container.appendChild(p);
    return;
  }
  container.appendChild(buildHiscoreTable(list, newHiscoreIndex));
}

function renderHiscores(list) {
  const data = list || loadHiscores();
  renderHiscoresInto(menuHiscoresEl, data);
  renderHiscoresInto(overlayHiscoresEl, data);
}

function submitHiscore() {
  if (hiscoreFormEl.classList.contains("hidden")) return;
  hiscoreFormEl.classList.add("hidden");
  const name = hiscoreNameEl.value.trim().slice(0, NAME_MAX) || DEFAULT_NAME;
  const entry = {
    name,
    score,
    lines,
    combo: maxCombo,
    mode: MODE_NAMES[mode] || "",
    date: new Date().toISOString(),
  };
  const list = loadHiscores();
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const trimmed = list.slice(0, HISCORES_MAX);
  newHiscoreIndex = trimmed.indexOf(entry);
  saveHiscores(trimmed);
  // se pinta la lista en memoria: si localStorage falla, la fila resaltada
  // sigue siendo la correcta en pantalla
  renderHiscores(trimmed);
}

// si el jugador sale del overlay sin pulsar Guardar, no perdemos el record
function autoSubmitHiscore() {
  if (!hiscoreFormEl.classList.contains("hidden")) submitHiscore();
}

function clearHiscores() {
  if (!confirm("¿Seguro que quieres borrar todos los records?")) return;
  try {
    localStorage.removeItem(HISCORES_KEY);
  } catch (err) {
    /* nada que hacer */
  }
  newHiscoreIndex = -1;
  renderHiscores();
}

function hideHiscoreForm() {
  hiscoreFormEl.classList.add("hidden");
}

function endGame(reason) {
  if (gameOver) return;
  gameOver = true;
  cancelAnimationFrame(animId);
  if (reason === "win") {
    const used = TIME_LIMIT_MS - timeLeftMs;
    overlayTitle.textContent = "¡COMPLETADO!";
    overlayScore.textContent = `Tiempo: ${formatTime(used)} · Puntuación: ${score.toLocaleString()}`;
  } else if (reason === "timeout") {
    overlayTitle.textContent = "SE ACABÓ EL TIEMPO";
    overlayScore.textContent = `${lines}/${TIME_TARGET_LINES} líneas · Puntuación: ${score.toLocaleString()}`;
  } else {
    overlayTitle.textContent = "GAME OVER";
    overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  }
  newHiscoreIndex = -1;
  overlayHiscoresEl.classList.remove("hidden");
  renderHiscores();
  const isRecord = qualifiesForHiscores(score);
  hiscoreFormEl.classList.toggle("hidden", !isRecord);
  overlay.classList.remove("hidden");
  if (isRecord) {
    // se conserva el último nombre escrito; "ANON" solo como valor inicial
    if (!hiscoreNameEl.value.trim()) hiscoreNameEl.value = DEFAULT_NAME;
    hiscoreNameEl.focus();
    hiscoreNameEl.select();
  }
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = "PAUSA";
    overlayScore.textContent = "";
    hideHiscoreForm();
    overlayHiscoresEl.classList.add("hidden");
    overlay.classList.remove("hidden");
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  if (freezeMs > 0) {
    const before = Math.ceil(freezeMs / 1000);
    freezeMs = Math.max(0, freezeMs - dt);
    dropAccum = 0;
    if (Math.ceil(freezeMs / 1000) !== before) updatePowerHUD();
  } else {
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }
  }

  if (!gameOver && mode === MODES.TIME) {
    const before = Math.ceil(timeLeftMs / 1000);
    timeLeftMs -= dt;
    if (Math.ceil(Math.max(0, timeLeftMs) / 1000) !== before) updateHUD();
    if (timeLeftMs <= 0) endGame("timeout");
  }

  if (!gameOver && mode === MODES.GARBAGE) {
    const before = Math.ceil((GARBAGE_INTERVAL - garbageAccum) / 1000);
    garbageAccum += dt;
    if (garbageAccum >= GARBAGE_INTERVAL) {
      garbageAccum = 0;
      addGarbageRow();
      updateHUD();
    } else if (Math.ceil((GARBAGE_INTERVAL - garbageAccum) / 1000) !== before) {
      updateHUD();
    }
  }

  draw();
  if (gameOver || paused) return;
  animId = requestAnimationFrame(loop);
}

function startGame(m) {
  mode = MODE_NAMES[m] ? m : MODES.NORMAL;
  timeLeftMs = TIME_LIMIT_MS;
  garbageAccum = 0;
  applyModeUI();
  menuEl.classList.add("hidden");
  init();
}

function showMenu() {
  cancelAnimationFrame(animId);
  gameOver = true;
  paused = false;
  overlay.classList.add("hidden");
  hideHiscoreForm();
  renderHiscores();
  menuEl.classList.remove("hidden");
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  armedPower = null;
  freezeMs = 0;
  firingPower = false;
  lastLockX = Math.floor(COLS / 2);
  lastLockY = ROWS - 1;
  combo = 0;
  maxCombo = 0;
  newHiscoreIndex = -1;
  hideHiscoreForm();
  next = randomPiece();
  spawn();
  updateHUD();
  updatePowerHUD();
  overlay.classList.add("hidden");
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener("keydown", (e) => {
  if (e.code === "KeyP") {
    togglePause();
    return;
  }
  if (paused || gameOver) return;
  switch (e.code) {
    case "ArrowLeft":
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case "ArrowRight":
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case "ArrowDown":
      softDrop();
      break;
    case "ArrowUp":
    case "KeyX":
      tryRotate();
      break;
    case "Space":
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener("click", () => {
  autoSubmitHiscore();
  startGame(mode);
});
menuBtn.addEventListener("click", () => {
  autoSubmitHiscore();
  showMenu();
});
modeButtons.forEach((btn) =>
  btn.addEventListener("click", () => startGame(btn.dataset.mode)),
);
themeToggleBtn.addEventListener("click", toggleTheme);
hiscoreSaveBtn.addEventListener("click", submitHiscore);
hiscoreNameEl.addEventListener("keydown", (e) => {
  e.stopPropagation();
  if (e.key === "Enter") submitHiscore();
});
clearHiscoresBtn.addEventListener("click", clearHiscores);

applyTheme(localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark");
showMenu();
