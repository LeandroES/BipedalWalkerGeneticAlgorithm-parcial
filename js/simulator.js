// Headless physics simulator + live simulator factory.
// Uses Matter.Engine.update() directly (not Runner) for maximum throughput.

import { createAvatar } from './avatar.js';

export const STEPS              = 1000;
export const DT                 = 1000 / 60;
export const OSCILLATION_PERIOD = 60;
const KP                        = 0.4;
export const WORLD_WIDTH        = 20000;
export const GROUND_Y           = 300;
export const SPAWN_X            = 200; // avatar always spawns here; fitness = endX - SPAWN_X
const FALL_THRESHOLD            = GROUND_Y - 20;

// Obstacle config — positions are absolute world X (spawn is at x=200)
export const OBSTACLE_POSITIONS = [500, 800, 1200]; // x from world origin
const OBSTACLE_W   = 22;
const OBSTACLE_H   = 30;
const OBS_CATEGORY = 0x0004; // collides with avatar (0x0002) but not ground

// Joint descriptor: [avatarKeyA, avatarKeyB, phaseIdx, ampIdx]
const JOINT_DESCRIPTORS = [
  ['torso',   'thigh_L', 0, 1],
  ['thigh_L', 'shin_L',  2, 3],
  ['torso',   'thigh_R', 4, 5],
  ['thigh_R', 'shin_R',  6, 7],
];

export function applyJointControl(avatar, genes, step) {
  const { Body } = Matter;
  const freq = (genes[8] ?? 1.0);
  const t    = (2 * Math.PI * step * freq) / OSCILLATION_PERIOD;

  for (const [segA, segB, phaseIdx, ampIdx] of JOINT_DESCRIPTORS) {
    const bodyA = avatar[segA];
    const bodyB = avatar[segB];
    const targetAngle    = genes[ampIdx] * Math.sin(t + genes[phaseIdx]);
    const currentRelAngle = bodyB.angle - bodyA.angle;
    const error           = targetAngle - currentRelAngle;
    Body.setAngularVelocity(bodyB, KP * error);
  }
}

function makeGround(world) {
  const { Bodies, World } = Matter;
  const ground = Bodies.rectangle(WORLD_WIDTH / 2, GROUND_Y + 25, WORLD_WIDTH, 50, {
    isStatic: true,
    label: 'ground',
    friction: 0.9,
    restitution: 0.0,
    collisionFilter: { category: 0x0001, mask: 0x0002 | OBS_CATEGORY },
  });
  World.add(world, ground);
}

function makeObstacles(world) {
  const { Bodies, World } = Matter;
  for (const ox of OBSTACLE_POSITIONS) {
    const obs = Bodies.rectangle(ox, GROUND_Y - OBSTACLE_H / 2, OBSTACLE_W, OBSTACLE_H, {
      isStatic: true,
      label: 'obstacle',
      friction: 0.5,
      restitution: 0.1,
      collisionFilter: { category: OBS_CATEGORY, mask: 0x0002 },
    });
    World.add(world, obs);
  }
}

// Headless evaluation — returns fitness score.
export function simulate(genome, withObstacles = false) {
  const { Engine, World } = Matter;

  const engine = Engine.create({ gravity: { x: 0, y: 1.0 } });
  const world  = engine.world;
  makeGround(world);
  if (withObstacles) makeObstacles(world);

  const avatar = createAvatar(world, SPAWN_X, GROUND_Y);
  const startX = avatar.torso.position.x;

  let fell = false;

  for (let step = 0; step < STEPS; step++) {
    applyJointControl(avatar, genome.genes, step);
    Engine.update(engine, DT);

    if (avatar.torso.position.y > FALL_THRESHOLD) {
      fell = true;
      break;
    }
  }

  const endX          = avatar.torso.position.x;
  const distanceMoved = Math.max(0, endX - startX);
  const fallPenalty   = fell ? Math.min(distanceMoved * 0.5, 80) : 0;
  let fitness         = Math.max(0, distanceMoved - fallPenalty);

  // Bonus for each obstacle cleared (torso passed obstacle x + half-width)
  if (withObstacles) {
    for (const ox of OBSTACLE_POSITIONS) {
      if (endX > ox + OBSTACLE_W) fitness += 200;
    }
  }

  World.clear(world);
  Engine.clear(engine);

  return fitness;
}

// Returns a live simulator object for the RAF state machine in main.js.
export function createLiveSimulator(genome, withObstacles = false) {
  const { Engine, World } = Matter;

  const engine = Engine.create({ gravity: { x: 0, y: 1.0 } });
  const world  = engine.world;
  makeGround(world);
  if (withObstacles) makeObstacles(world);

  const avatar = createAvatar(world, SPAWN_X, GROUND_Y);

  return {
    avatar,
    step(stepIndex) {
      applyJointControl(avatar, genome.genes, stepIndex);
      Engine.update(engine, DT);
    },
    dispose() {
      World.clear(world);
      Engine.clear(engine);
    },
  };
}
