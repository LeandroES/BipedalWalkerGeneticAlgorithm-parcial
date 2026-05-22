// Canvas 2D renderer for the avatar, environment, and HUD.

import { GROUND_Y, WORLD_WIDTH, OBSTACLE_POSITIONS, SPAWN_X } from './simulator.js';

const CANVAS_W = 900;
const CANVAS_H = 400;

const COLORS = {
  skyTop:    '#1a6b9e',
  skyBot:    '#87CEEB',
  grassTop:  '#2d8a4e',
  grassMid:  '#27ae60',
  soil:      '#6b3a2a',
  torso:     '#2c3e50',
  thigh:     '#e74c3c',
  shin:      '#c0392b',
  constraint:'rgba(255,255,255,0.25)',
};

let skyGradient = null;

function getSkyGradient(ctx) {
  if (!skyGradient) {
    skyGradient = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    skyGradient.addColorStop(0,   COLORS.skyTop);
    skyGradient.addColorStop(1,   COLORS.skyBot);
  }
  return skyGradient;
}

function drawGround(ctx, cameraX) {
  // Soil strip
  ctx.fillStyle = COLORS.soil;
  ctx.fillRect(cameraX, GROUND_Y + 1, WORLD_WIDTH, CANVAS_H - GROUND_Y);

  // Grass surface
  ctx.fillStyle = COLORS.grassMid;
  ctx.fillRect(cameraX, GROUND_Y, WORLD_WIDTH, 14);

  // Dark grass blades (tiled)
  ctx.fillStyle = COLORS.grassTop;
  for (let x = Math.floor(cameraX / 24) * 24; x < cameraX + CANVAS_W + 24; x += 24) {
    ctx.fillRect(x, GROUND_Y, 12, 10);
  }

  // Start line at spawn — fitness = 0 here, matches "Pos: 0 px" in HUD
  ctx.strokeStyle = 'rgba(255,220,50,0.75)';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(SPAWN_X, GROUND_Y - 70);
  ctx.lineTo(SPAWN_X, GROUND_Y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,220,50,0.9)';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('INICIO', SPAWN_X, GROUND_Y - 74);
  // "0" label below start line, same style as distance markers
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '11px monospace';
  ctx.fillText('0', SPAWN_X + 3, GROUND_Y + 26);
  ctx.textAlign = 'left';

  // Distance markers every 200px from spawn — labels match Pos px in HUD exactly
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.font = '11px monospace';
  for (let d = 200; SPAWN_X + d < WORLD_WIDTH; d += 200) {
    const mx = SPAWN_X + d;
    ctx.fillRect(mx, GROUND_Y + 14, 1, 10);
    ctx.fillText(`${d}`, mx + 3, GROUND_Y + 26);
  }
}

function bodyColor(label) {
  if (label === 'torso')   return COLORS.torso;
  if (label.startsWith('thigh')) return COLORS.thigh;
  if (label.startsWith('shin'))  return COLORS.shin;
  return '#888';
}

function drawBody(ctx, body) {
  const { x, y } = body.position;
  const verts = body.vertices;

  ctx.beginPath();
  ctx.moveTo(verts[0].x, verts[0].y);
  for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
  ctx.closePath();
  ctx.fillStyle = bodyColor(body.label);
  ctx.fill();

  // Highlight edge
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawConstraints(ctx, constraints) {
  ctx.strokeStyle = COLORS.constraint;
  ctx.lineWidth = 2;
  for (const c of constraints) {
    if (!c.bodyA || !c.bodyB) continue;
    const ax = c.bodyA.position.x + (c.pointA ? c.pointA.x : 0);
    const ay = c.bodyA.position.y + (c.pointA ? c.pointA.y : 0);
    const bx = c.bodyB.position.x + (c.pointB ? c.pointB.x : 0);
    const by = c.bodyB.position.y + (c.pointB ? c.pointB.y : 0);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }
}

export function drawFrame(ctx, avatar, genInfo) {
  if (!avatar) return;

  const torsoX  = avatar.torso.position.x;
  const cameraX = torsoX - CANVAS_W / 2;

  // Sky
  ctx.fillStyle = getSkyGradient(ctx);
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // World transform
  ctx.save();
  ctx.translate(-cameraX, 0);

  drawGround(ctx, cameraX);

  // Draw obstacles if active
  if (genInfo && genInfo.obstacleMode) {
    drawObstacles(ctx);
  }

  // Draw constraints first (behind bodies)
  drawConstraints(ctx, Object.values(avatar.constraints));

  // Draw all bodies
  for (const body of avatar.allBodies) {
    drawBody(ctx, body);
  }

  ctx.restore();

  // HUD — screen space
  drawHUD(ctx, genInfo);
}

function drawObstacles(ctx) {
  const W = 22, H = 30;
  for (const ox of OBSTACLE_POSITIONS) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(ox - W / 2 + 3, GROUND_Y - H + 3, W, H);
    // Body
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(ox - W / 2, GROUND_Y - H, W, H);
    // Highlight top
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(ox - W / 2, GROUND_Y - H, W, 5);
    // Left edge light
    ctx.fillStyle = '#795548';
    ctx.fillRect(ox - W / 2, GROUND_Y - H, 4, H);
  }
}

function drawHUD(ctx, info) {
  if (!info) return;
  const lines = info.obstacleMode ? 5 : 4;
  const h = 14 + lines * 16;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(8, 8, 220, h);

  ctx.fillStyle = '#a0c4ff';
  ctx.font = 'bold 13px Segoe UI, sans-serif';
  ctx.fillText(`Generación: ${info.generation}`, 16, 26);

  ctx.fillStyle = '#eaeaea';
  ctx.font = '11px monospace';
  // currentDist = live avatar position from spawn (matches ground markers)
  const dist = info.currentDist ?? 0;
  ctx.fillText(`Pos:    ${dist.toFixed(1)} px`, 16, 42);
  ctx.fillText(`Mejor:  ${info.bestFitness.toFixed(1)} px`, 16, 58);
  ctx.fillText(`Avg:    ${info.avgFitness.toFixed(1)} px`, 16, 74);

  if (info.obstacleMode) {
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 11px Segoe UI, sans-serif';
    ctx.fillText('⚠ MODO OBSTÁCULOS ACTIVO', 16, 90);
  }
}

export function drawSparkline(ctx, history, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0f1b35';
  ctx.fillRect(0, 0, w, h);

  if (history.length < 2) return;

  const max = Math.max(...history, 1);
  ctx.strokeStyle = '#27ae60';
  ctx.lineWidth = 1.5;
  ctx.beginPath();

  history.forEach((v, i) => {
    const x = (i / (history.length - 1)) * w;
    const y = h - (v / max) * (h - 4) - 2;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Axis label
  ctx.fillStyle = 'rgba(160,196,255,0.7)';
  ctx.font = '9px monospace';
  ctx.fillText(`${max.toFixed(0)}`, 2, 10);
}

export { CANVAS_W, CANVAS_H };
