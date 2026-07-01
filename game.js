const STORAGE_KEYS = {
  easy: "romako_bh_highscore_easy",
  hard: "romako_bh_highscore_hard",
};

const DIFFICULTY_CONFIG = {
  easy: {
    label: "EASY",
    backgroundKey: "easy",
    playerSpeed: 220,
    playerRadius: 16,
    bhInitialRadius: 30,
    bhGrowthRate: 3,
    bhGravityStrength: 15000,
    bhGravityRamp: 0.018,
    meteorSpawnInterval: 1.5,
    meteorSpeed: 120,
    meteorRadiusMin: 14,
    meteorRadiusMax: 22,
  },
  hard: {
    label: "HARD",
    backgroundKey: "hard",
    playerSpeed: 200,
    playerRadius: 16,
    bhInitialRadius: 40,
    bhGrowthRate: 6,
    bhGravityStrength: 42000,
    bhGravityRamp: 0.045,
    meteorSpawnInterval: 0.7,
    meteorSpeed: 220,
    meteorRadiusMin: 14,
    meteorRadiusMax: 22,
  },
};

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const MAX_DT = 0.05;
const STAR_COUNT = 72;
const PLAYER_SPRITE_SOURCE = { x: 0, y: 0, width: 390, height: 700 };
const PLAYER_SPRITE_DRAW = { width: 72, height: 126, centerYOffset: 6 };
const PIG_METEOR_SPRITE_SOURCE = { x: 0, y: 0, width: 256, height: 256 };

const elements = {
  screens: {
    title: document.getElementById("screen-title"),
    play: document.getElementById("screen-play"),
    gameover: document.getElementById("screen-gameover"),
  },
  difficultyButtons: Array.from(document.querySelectorAll("[data-difficulty]")),
  startButton: document.getElementById("start-button"),
  retryButton: document.getElementById("retry-button"),
  backToTitleButton: document.getElementById("back-to-title-button"),
  titleHighscoreLabel: document.getElementById("title-highscore-label"),
  titleHighscoreValue: document.getElementById("title-highscore-value"),
  difficultyBadge: document.getElementById("difficulty-badge"),
  scoreValue: document.getElementById("score-value"),
  finalScore: document.getElementById("final-score"),
  bestScore: document.getElementById("best-score"),
  recordBanner: document.getElementById("record-banner"),
  canvas: document.getElementById("game-canvas"),
  mobileButtons: Array.from(document.querySelectorAll(".control-button")),
};

const ctx = elements.canvas.getContext("2d");
const playerSprite = new Image();
playerSprite.src = "assets/romaco_player.png";
playerSprite.addEventListener("load", () => {
  if (!gameRunning) {
    renderIdleCanvas();
  }
});
const pigMeteorSprite = new Image();
pigMeteorSprite.src = "assets/pig_meteor.png";
const backgroundImages = {
  easy: loadCanvasImage("assets/blackhole_easy.jpg"),
  hard: loadCanvasImage("assets/blackhole_hard.jpg"),
};

let currentScreen = "title";
let selectedDifficulty = "easy";
let currentConfig = DIFFICULTY_CONFIG[selectedDifficulty];
let animationFrameId = null;
let lastTimestamp = 0;
let gameRunning = false;
let elapsedTime = 0;
let meteorSpawnTimer = 0;
let newRecord = false;
let dragPointerId = null;
let dragPoint = null;

let player = null;
let blackHole = null;
let meteors = [];

const stars = createStars();
const keyState = { up: false, down: false, left: false, right: false };
const dpadState = { up: false, down: false, left: false, right: false };

function init() {
  bindUI();
  setDifficulty(selectedDifficulty);
  showScreen("title");
  renderIdleCanvas();
}

function bindUI() {
  elements.difficultyButtons.forEach((button) => {
    button.addEventListener("click", () => setDifficulty(button.dataset.difficulty));
  });

  elements.startButton.addEventListener("click", () => startGame(selectedDifficulty));
  elements.retryButton.addEventListener("click", () => startGame(selectedDifficulty));
  elements.backToTitleButton.addEventListener("click", () => {
    stopGameLoop();
    renderIdleCanvas();
    showScreen("title");
  });

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("blur", clearAllInputs);

  bindMobileControls();
  bindCanvasDrag();
}

function bindMobileControls() {
  elements.mobileButtons.forEach((button) => {
    const direction = button.dataset.direction;

    const press = (event) => {
      event.preventDefault();
      dpadState[direction] = true;
      button.classList.add("is-pressed");
    };

    const release = (event) => {
      event.preventDefault();
      dpadState[direction] = false;
      button.classList.remove("is-pressed");
    };

    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);
  });
}

function bindCanvasDrag() {
  elements.canvas.addEventListener("pointerdown", (event) => {
    dragPointerId = event.pointerId;
    dragPoint = getCanvasPoint(event);
    elements.canvas.setPointerCapture(event.pointerId);
  });

  elements.canvas.addEventListener("pointermove", (event) => {
    if (event.pointerId !== dragPointerId) {
      return;
    }
    dragPoint = getCanvasPoint(event);
  });

  const stopDrag = (event) => {
    if (event.pointerId !== dragPointerId) {
      return;
    }
    dragPointerId = null;
    dragPoint = null;
  };

  elements.canvas.addEventListener("pointerup", stopDrag);
  elements.canvas.addEventListener("pointercancel", stopDrag);
}

function handleKeyDown(event) {
  const direction = getDirectionFromKey(event.key);
  if (!direction) {
    return;
  }

  event.preventDefault();
  keyState[direction] = true;
}

function handleKeyUp(event) {
  const direction = getDirectionFromKey(event.key);
  if (!direction) {
    return;
  }

  event.preventDefault();
  keyState[direction] = false;
}

function getDirectionFromKey(key) {
  const map = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    w: "up",
    W: "up",
    s: "down",
    S: "down",
    a: "left",
    A: "left",
    d: "right",
    D: "right",
  };
  return map[key] || null;
}

function clearAllInputs() {
  Object.keys(keyState).forEach((key) => {
    keyState[key] = false;
    dpadState[key] = false;
  });
  elements.mobileButtons.forEach((button) => button.classList.remove("is-pressed"));
  dragPointerId = null;
  dragPoint = null;
}

function setDifficulty(difficulty) {
  selectedDifficulty = difficulty;
  currentConfig = DIFFICULTY_CONFIG[difficulty];

  elements.difficultyButtons.forEach((button) => {
    button.classList.toggle("chip-active", button.dataset.difficulty === difficulty);
  });

  elements.difficultyBadge.textContent = currentConfig.label;
  elements.titleHighscoreLabel.textContent = `${currentConfig.label} ベスト`;
  elements.titleHighscoreValue.textContent = formatSeconds(readHighScore(difficulty));

  if (!gameRunning && currentScreen === "title") {
    renderIdleCanvas();
  }
}

function showScreen(screenName) {
  currentScreen = screenName;
  Object.entries(elements.screens).forEach(([name, screen]) => {
    screen.classList.toggle("screen-active", name === screenName);
  });
}

function startGame(difficulty) {
  stopGameLoop();
  clearAllInputs();

  currentConfig = DIFFICULTY_CONFIG[difficulty];
  selectedDifficulty = difficulty;
  elapsedTime = 0;
  meteorSpawnTimer = 0;
  newRecord = false;
  lastTimestamp = 0;
  meteors = [];

  player = {
    x: CANVAS_WIDTH * 0.18,
    y: CANVAS_HEIGHT * 0.5,
    radius: currentConfig.playerRadius,
  };

  blackHole = {
    x: CANVAS_WIDTH * 0.5,
    y: CANVAS_HEIGHT * 0.5,
    radius: currentConfig.bhInitialRadius,
  };

  elements.scoreValue.textContent = "0.0";
  elements.difficultyBadge.textContent = currentConfig.label;
  showScreen("play");

  gameRunning = true;
  animationFrameId = requestAnimationFrame(gameLoop);
}

function stopGameLoop() {
  gameRunning = false;
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

function gameLoop(timestamp) {
  if (!gameRunning) {
    return;
  }

  if (!lastTimestamp) {
    lastTimestamp = timestamp;
  }

  const dt = Math.min((timestamp - lastTimestamp) / 1000, MAX_DT);
  lastTimestamp = timestamp;

  updateGame(dt);
  renderGame();

  if (gameRunning) {
    animationFrameId = requestAnimationFrame(gameLoop);
  }
}

function updateGame(dt) {
  elapsedTime += dt;
  meteorSpawnTimer += dt;
  elements.scoreValue.textContent = elapsedTime.toFixed(1);

  const inputVector = getInputVector();
  const gravityVector = getGravityVector();

  player.x += (inputVector.x * currentConfig.playerSpeed + gravityVector.x) * dt;
  player.y += (inputVector.y * currentConfig.playerSpeed + gravityVector.y) * dt;

  clampPlayerToBounds();

  blackHole.radius += currentConfig.bhGrowthRate * dt;

  if (meteorSpawnTimer >= currentConfig.meteorSpawnInterval) {
    meteorSpawnTimer -= currentConfig.meteorSpawnInterval;
    spawnMeteor();
  }

  updateMeteors(dt);

  if (isColliding(player, blackHole) || meteors.some((meteor) => isColliding(player, meteor))) {
    endGame();
  }
}

function getInputVector() {
  let x = 0;
  let y = 0;

  if (keyState.left || dpadState.left) {
    x -= 1;
  }
  if (keyState.right || dpadState.right) {
    x += 1;
  }
  if (keyState.up || dpadState.up) {
    y -= 1;
  }
  if (keyState.down || dpadState.down) {
    y += 1;
  }

  if (x === 0 && y === 0 && dragPoint) {
    x = dragPoint.x - player.x;
    y = dragPoint.y - player.y;
  }

  return normalizeVector(x, y);
}

function getGravityVector() {
  const dx = blackHole.x - player.x;
  const dy = blackHole.y - player.y;
  const distance = Math.hypot(dx, dy) || 1;
  const direction = normalizeVector(dx, dy);
  const distanceFromEdge = Math.max(distance - blackHole.radius, 35);
  const timeRamp = Math.min(2.4, 0.65 + elapsedTime * currentConfig.bhGravityRamp);
  const proximityBoost = 1 + Math.max(0, 170 - distanceFromEdge) / 170;
  const force = (currentConfig.bhGravityStrength / distanceFromEdge) * timeRamp * proximityBoost;

  return {
    x: direction.x * force,
    y: direction.y * force,
  };
}

function clampPlayerToBounds() {
  player.x = clamp(player.x, player.radius, CANVAS_WIDTH - player.radius);
  player.y = clamp(player.y, player.radius, CANVAS_HEIGHT - player.radius);
}

function spawnMeteor() {
  const side = Math.floor(Math.random() * 4);
  const radius = randomRange(currentConfig.meteorRadiusMin, currentConfig.meteorRadiusMax);
  let x = 0;
  let y = 0;

  if (side === 0) {
    x = randomRange(0, CANVAS_WIDTH);
    y = -radius - 12;
  } else if (side === 1) {
    x = CANVAS_WIDTH + radius + 12;
    y = randomRange(0, CANVAS_HEIGHT);
  } else if (side === 2) {
    x = randomRange(0, CANVAS_WIDTH);
    y = CANVAS_HEIGHT + radius + 12;
  } else {
    x = -radius - 12;
    y = randomRange(0, CANVAS_HEIGHT);
  }

  const targetX = CANVAS_WIDTH * 0.5 + randomRange(-CANVAS_WIDTH * 0.18, CANVAS_WIDTH * 0.18);
  const targetY = CANVAS_HEIGHT * 0.5 + randomRange(-CANVAS_HEIGHT * 0.18, CANVAS_HEIGHT * 0.18);
  const direction = normalizeVector(targetX - x, targetY - y);

  meteors.push({
    x,
    y,
    radius,
    vx: direction.x * currentConfig.meteorSpeed,
    vy: direction.y * currentConfig.meteorSpeed,
    rotation: randomRange(0, Math.PI * 2),
    spin: randomRange(-2.4, 2.4),
  });
}

function updateMeteors(dt) {
  meteors = meteors.filter((meteor) => {
    const dx = blackHole.x - meteor.x;
    const dy = blackHole.y - meteor.y;
    const distance = Math.max(Math.hypot(dx, dy), 60);
    const gravity = 900 / distance;

    meteor.vx += (dx / distance) * gravity;
    meteor.vy += (dy / distance) * gravity;
    meteor.x += meteor.vx * dt;
    meteor.y += meteor.vy * dt;
    meteor.rotation += meteor.spin * dt;

    const margin = meteor.radius + 40;
    return !(
      meteor.x < -margin ||
      meteor.x > CANVAS_WIDTH + margin ||
      meteor.y < -margin ||
      meteor.y > CANVAS_HEIGHT + margin
    );
  });
}

function endGame() {
  stopGameLoop();

  const previousBest = readHighScore(selectedDifficulty);
  const finalValue = Number(elapsedTime.toFixed(1));
  const bestValue = Math.max(previousBest, finalValue);
  newRecord = finalValue > previousBest;

  if (newRecord) {
    saveHighScore(selectedDifficulty, finalValue);
  }

  elements.finalScore.textContent = formatSeconds(finalValue);
  elements.bestScore.textContent = formatSeconds(bestValue);
  elements.recordBanner.hidden = !newRecord;

  setDifficulty(selectedDifficulty);
  showScreen("gameover");
}

function renderIdleCanvas() {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawBackground();
  drawStars();

  const previewBlackHole = {
    x: CANVAS_WIDTH * 0.5,
    y: CANVAS_HEIGHT * 0.5,
    radius: 46,
  };
  drawBlackHole(previewBlackHole);
  drawPlayer({
    x: CANVAS_WIDTH * 0.22,
    y: CANVAS_HEIGHT * 0.54,
    radius: 16,
  });
}

function renderGame() {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawBackground();
  drawStars();
  drawBlackHole(blackHole);
  meteors.forEach(drawMeteor);
  drawPlayer(player);
}

function drawBackground() {
  const backgroundImage = backgroundImages[currentConfig.backgroundKey];
  if (backgroundImage.complete && backgroundImage.naturalWidth > 0) {
    drawImageCover(backgroundImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawDifficultyAtmosphere();
    return;
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  gradient.addColorStop(0, "#12254a");
  gradient.addColorStop(0.55, "#081223");
  gradient.addColorStop(1, "#03060d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

function drawImageCover(image, x, y, width, height) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;

  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function drawDifficultyAtmosphere() {
  const overlay = ctx.createRadialGradient(CANVAS_WIDTH * 0.5, CANVAS_HEIGHT * 0.5, 60, CANVAS_WIDTH * 0.5, CANVAS_HEIGHT * 0.5, CANVAS_WIDTH * 0.65);
  if (selectedDifficulty === "hard") {
    overlay.addColorStop(0, "rgba(0, 0, 0, 0.05)");
    overlay.addColorStop(0.62, "rgba(255, 80, 42, 0.08)");
    overlay.addColorStop(1, "rgba(0, 0, 0, 0.58)");
  } else {
    overlay.addColorStop(0, "rgba(0, 0, 0, 0.04)");
    overlay.addColorStop(0.65, "rgba(55, 218, 220, 0.06)");
    overlay.addColorStop(1, "rgba(0, 0, 0, 0.5)");
  }
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

function drawStars() {
  stars.forEach((star) => {
    ctx.globalAlpha = star.alpha;
    ctx.fillStyle = star.color;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawBlackHole(entity) {
  const glow = ctx.createRadialGradient(entity.x, entity.y, entity.radius * 0.5, entity.x, entity.y, entity.radius * 2.3);
  glow.addColorStop(0, "rgba(0, 0, 0, 0.96)");
  glow.addColorStop(0.45, "rgba(27, 6, 49, 0.8)");
  glow.addColorStop(0.72, "rgba(35, 90, 162, 0.35)");
  glow.addColorStop(1, "rgba(35, 90, 162, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(entity.x, entity.y, entity.radius * 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#010103";
  ctx.beginPath();
  ctx.arc(entity.x, entity.y, entity.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(132, 244, 214, 0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(entity.x, entity.y, entity.radius + 4, 0, Math.PI * 2);
  ctx.stroke();
}

function drawPlayer(entity) {
  if (playerSprite.complete && playerSprite.naturalWidth > 0) {
    drawPlayerSprite(entity);
    return;
  }

  ctx.save();
  ctx.translate(entity.x, entity.y);

  ctx.fillStyle = "#ff8eb7";
  ctx.beginPath();
  ctx.arc(0, 0, entity.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(-5, -3, 2.8, 0, Math.PI * 2);
  ctx.arc(5, -3, 2.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#2e1938";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 4, 6, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  ctx.fillStyle = "#ffd166";
  ctx.beginPath();
  ctx.moveTo(-8, -entity.radius + 4);
  ctx.lineTo(-2, -entity.radius - 6);
  ctx.lineTo(0, -entity.radius + 1);
  ctx.lineTo(3, -entity.radius - 8);
  ctx.lineTo(7, -entity.radius + 4);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawPlayerSprite(entity) {
  const drawWidth = PLAYER_SPRITE_DRAW.width;
  const drawHeight = PLAYER_SPRITE_DRAW.height;
  const dx = entity.x - drawWidth / 2;
  const dy = entity.y - drawHeight / 2 - PLAYER_SPRITE_DRAW.centerYOffset;

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 8;
  ctx.drawImage(
    playerSprite,
    PLAYER_SPRITE_SOURCE.x,
    PLAYER_SPRITE_SOURCE.y,
    PLAYER_SPRITE_SOURCE.width,
    PLAYER_SPRITE_SOURCE.height,
    dx,
    dy,
    drawWidth,
    drawHeight
  );
  ctx.restore();
}

function drawMeteor(meteor) {
  if (pigMeteorSprite.complete && pigMeteorSprite.naturalWidth > 0) {
    drawPigMeteor(meteor);
    return;
  }

  ctx.save();
  ctx.translate(meteor.x, meteor.y);
  ctx.rotate((meteor.vx + meteor.vy) * 0.002);

  ctx.fillStyle = `hsl(${meteor.hue} 84% 58%)`;
  ctx.beginPath();
  ctx.arc(0, 0, meteor.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 230, 180, 0.55)";
  ctx.beginPath();
  ctx.arc(-meteor.radius * 0.28, -meteor.radius * 0.22, meteor.radius * 0.34, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawPigMeteor(meteor) {
  const speedAngle = Math.atan2(meteor.vy, meteor.vx);
  const drawSize = meteor.radius * 3.2;

  ctx.save();
  ctx.translate(meteor.x, meteor.y);
  ctx.rotate(speedAngle);

  const trail = ctx.createLinearGradient(-drawSize * 1.05, 0, -drawSize * 0.15, 0);
  trail.addColorStop(0, "rgba(255, 80, 80, 0)");
  trail.addColorStop(0.45, "rgba(255, 127, 57, 0.32)");
  trail.addColorStop(1, "rgba(255, 214, 102, 0.62)");
  ctx.fillStyle = trail;
  ctx.beginPath();
  ctx.moveTo(-drawSize * 1.05, 0);
  ctx.lineTo(-drawSize * 0.18, -meteor.radius * 0.78);
  ctx.lineTo(-drawSize * 0.04, 0);
  ctx.lineTo(-drawSize * 0.18, meteor.radius * 0.78);
  ctx.closePath();
  ctx.fill();

  ctx.rotate(meteor.rotation);
  ctx.shadowColor = "rgba(0, 0, 0, 0.42)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 5;
  ctx.drawImage(
    pigMeteorSprite,
    PIG_METEOR_SPRITE_SOURCE.x,
    PIG_METEOR_SPRITE_SOURCE.y,
    PIG_METEOR_SPRITE_SOURCE.width,
    PIG_METEOR_SPRITE_SOURCE.height,
    -drawSize / 2,
    -drawSize / 2,
    drawSize,
    drawSize
  );
  ctx.restore();
}

function isColliding(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y) < a.radius + b.radius;
}

function readHighScore(difficulty) {
  const value = window.localStorage.getItem(STORAGE_KEYS[difficulty]);
  return value ? Number(value) : 0;
}

function saveHighScore(difficulty, score) {
  window.localStorage.setItem(STORAGE_KEYS[difficulty], score.toFixed(1));
}

function formatSeconds(value) {
  return `${Number(value).toFixed(1)} 秒`;
}

function createStars() {
  const palette = ["rgba(255,255,255,0.95)", "rgba(132,244,214,0.95)", "rgba(255,209,102,0.85)"];
  return Array.from({ length: STAR_COUNT }, () => ({
    x: randomRange(0, CANVAS_WIDTH),
    y: randomRange(0, CANVAS_HEIGHT),
    radius: randomRange(0.8, 2.1),
    alpha: randomRange(0.35, 0.95),
    color: palette[Math.floor(Math.random() * palette.length)],
  }));
}

function normalizeVector(x, y) {
  const length = Math.hypot(x, y);
  if (!length) {
    return { x: 0, y: 0 };
  }

  return { x: x / length, y: y / length };
}

function getCanvasPoint(event) {
  const rect = elements.canvas.getBoundingClientRect();
  const scaleX = CANVAS_WIDTH / rect.width;
  const scaleY = CANVAS_HEIGHT / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function loadCanvasImage(src) {
  const image = new Image();
  image.src = src;
  image.addEventListener("load", () => {
    if (!gameRunning) {
      renderIdleCanvas();
    }
  });
  return image;
}

init();
