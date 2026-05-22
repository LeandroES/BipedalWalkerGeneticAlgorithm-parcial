import { Population } from './population.js';
import { createLiveSimulator, STEPS, SPAWN_X } from './simulator.js';
import { drawFrame, drawSparkline, CANVAS_W, CANVAS_H } from './renderer.js';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const mainCanvas      = document.getElementById('mainCanvas');
const sparkCanvas     = document.getElementById('sparklineCanvas');
const btnStart        = document.getElementById('btnStart');
const btnReset        = document.getElementById('btnReset');
const btnApply        = document.getElementById('btnApply');
const speedBtns       = document.querySelectorAll('.speed-btn');
const elGeneration    = document.getElementById('genValue');
const elBestFitness   = document.getElementById('bestValue');
const elAvgFitness    = document.getElementById('avgValue');
const elFitnessBar    = document.getElementById('fitnessBar');
const elFitnessLimit  = document.getElementById('lblFitnessLimit');
const inpPopSize      = document.getElementById('inpPopSize');
const inpFitnessLimit = document.getElementById('inpFitnessLimit');

mainCanvas.width  = CANVAS_W;
mainCanvas.height = CANVAS_H;

const ctx      = mainCanvas.getContext('2d');
const sparkCtx = sparkCanvas.getContext('2d');

// ── Helpers to read config inputs ─────────────────────────────────────────────
function getPopSize()      { return Math.max(20, Math.min(500, parseInt(inpPopSize.value,      10) || 150)); }
function getFitnessLimit() { return Math.max(200, Math.min(20000, parseInt(inpFitnessLimit.value, 10) || 1500)); }

// ── State ─────────────────────────────────────────────────────────────────────
let population  = new Population(getPopSize());
let running     = false;
let speedMult   = 1;
let gaState     = 'idle';   // 'evaluating' | 'displaying' | 'idle'
let evalIdx     = 0;
let displayStep = 0;
let liveSim     = null;

// ── Speed buttons ─────────────────────────────────────────────────────────────
speedBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    speedBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    speedMult = parseInt(btn.dataset.speed, 10);
  });
});

// ── Start / Pause ─────────────────────────────────────────────────────────────
btnStart.addEventListener('click', () => {
  running = !running;
  btnStart.textContent = running ? 'Pausar' : 'Iniciar';
  btnStart.classList.toggle('running', running);
  if (running && gaState === 'idle') {
    gaState = 'evaluating';
    evalIdx = 0;
  }
});

// ── Reset / Apply ─────────────────────────────────────────────────────────────
function doReset() {
  running = false;
  btnStart.textContent = 'Iniciar';
  btnStart.classList.remove('running');
  if (liveSim) { liveSim.dispose(); liveSim = null; }
  population = new Population(getPopSize());
  gaState    = 'idle';
  evalIdx    = 0;
  updateUI(0);
  drawIdleScreen();
}

btnReset.addEventListener('click', doReset);
btnApply.addEventListener('click', doReset);

// ── Single RAF loop — state machine ───────────────────────────────────────────
function frame() {
  if (running) {
    const popSize = population.size;

    if (gaState === 'evaluating') {
      const indsPerFrame = Math.max(1, speedMult * 2);
      for (let i = 0; i < indsPerFrame && evalIdx < popSize; i++) {
        population.evaluateOne(evalIdx++);
      }

      drawEvalProgress(evalIdx, popSize, population.generation + 1);

      if (evalIdx >= popSize) {
        population.finalize();
        population.breedNext();
        updateUI(population.bestFitness);

        if (liveSim) { liveSim.dispose(); liveSim = null; }
        liveSim     = createLiveSimulator(population.bestGenome, population.obstacleMode);
        displayStep = 0;
        gaState     = 'displaying';
      }

    } else if (gaState === 'displaying') {
      // Run speedMult physics steps per frame — uses STEPS (full evaluation length)
      const physicsPerFrame = speedMult;
      for (let i = 0; i < physicsPerFrame && displayStep < STEPS; i++) {
        liveSim.step(displayStep++);
      }

      // Live distance from spawn — matches ground markers exactly
      const currentDist = Math.max(0, liveSim.avatar.torso.position.x - SPAWN_X);

      drawFrame(ctx, liveSim.avatar, {
        generation:   population.generation,
        bestFitness:  population.bestFitness,
        avgFitness:   population.avgFitness,
        obstacleMode: population.obstacleMode,
        currentDist,
      });

      if (displayStep >= STEPS) {
        liveSim.dispose();
        liveSim = null;
        evalIdx = 0;
        gaState = 'evaluating';
      }
    }
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// ── UI helpers ────────────────────────────────────────────────────────────────
function updateUI(currentBest) {
  const limit = getFitnessLimit();
  elGeneration.textContent  = population.generation;
  elBestFitness.textContent = population.bestFitness.toFixed(1);
  elAvgFitness.textContent  = population.avgFitness.toFixed(1);
  if (elFitnessLimit) elFitnessLimit.textContent = `Fitness relativo (0 – ${limit} px)`;

  const pct = Math.min(100, (population.bestFitness / limit) * 100);
  elFitnessBar.style.width = pct + '%';

  drawSparkline(sparkCtx, population.fitnessHistory, sparkCanvas.width, sparkCanvas.height);
}

function drawEvalProgress(done, total, gen) {
  ctx.fillStyle = '#0f1b35';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  grad.addColorStop(0, '#1a6b9e');
  grad.addColorStop(1, '#87CEEB');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H * 0.75);

  ctx.fillStyle = '#27ae60';
  ctx.fillRect(0, CANVAS_H * 0.75, CANVAS_W, CANVAS_H * 0.25);

  const barW = 400, barH = 18;
  const bx   = (CANVAS_W - barW) / 2;
  const by   = CANVAS_H / 2 - 30;

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = 'bold 14px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Generación ${gen} — Evaluando individuos…`, CANVAS_W / 2, by - 10);
  ctx.textAlign = 'left';

  ctx.strokeStyle = '#2d4a8a';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, barW, barH);

  ctx.fillStyle = '#27ae60';
  ctx.fillRect(bx + 1, by + 1, Math.round((done / total) * (barW - 2)), barH - 2);

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${done} / ${total}`, CANVAS_W / 2, by + barH + 16);
  ctx.textAlign = 'left';
}

function drawIdleScreen() {
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  grad.addColorStop(0, '#1a6b9e');
  grad.addColorStop(1, '#87CEEB');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.fillStyle = '#27ae60';
  ctx.fillRect(0, CANVAS_H * 0.75, CANVAS_W, CANVAS_H * 0.25);

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = 'bold 18px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Presiona "Iniciar" para comenzar la evolución', CANVAS_W / 2, CANVAS_H / 2);
  ctx.textAlign = 'left';
}

drawIdleScreen();
