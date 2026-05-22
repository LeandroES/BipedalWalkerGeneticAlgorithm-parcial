// Creates a bipedal avatar using Matter.js bodies and constraints.
// Avatar parts collide with ground (0x0001) and obstacles (0x0004) but not each other (0x0002).

const AVATAR_CATEGORY   = 0x0002;
const GROUND_CATEGORY   = 0x0001;
const OBSTACLE_CATEGORY = 0x0004; // must match simulator.js OBS_CATEGORY

export function createAvatar(world, spawnX, groundY) {
  const { Bodies, Constraint, World } = Matter;

  const opts = {
    frictionAir: 0.03,   // more air drag — avatar stays upright longer
    friction: 0.9,
    restitution: 0.0,
    collisionFilter: { category: AVATAR_CATEGORY, mask: GROUND_CATEGORY | OBSTACLE_CATEGORY },
  };

  // Body positions relative to spawn
  const torsoY = groundY - 120;
  const torso  = Bodies.rectangle(spawnX,      torsoY,        40, 60, { ...opts, label: 'torso',   density: 0.001 });

  const thighLY = torsoY + 52;
  const thighRY = torsoY + 52;
  const thigh_L = Bodies.rectangle(spawnX - 10, thighLY,      14, 45, { ...opts, label: 'thigh_L', density: 0.0005 });
  const thigh_R = Bodies.rectangle(spawnX + 10, thighRY,      14, 45, { ...opts, label: 'thigh_R', density: 0.0005 });

  const shinLY = thighLY + 44;
  const shinRY = thighRY + 44;
  const shin_L  = Bodies.rectangle(spawnX - 10, shinLY,       12, 45, { ...opts, label: 'shin_L',  density: 0.0005 });
  const shin_R  = Bodies.rectangle(spawnX + 10, shinRY,       12, 45, { ...opts, label: 'shin_R',  density: 0.0005 });

  const constraintOpts = { stiffness: 0.8, damping: 0.05, length: 0 };

  const hip_L   = Constraint.create({ bodyA: torso,   pointA: { x: -10, y: 30 },   bodyB: thigh_L, pointB: { x: 0, y: -22.5 }, ...constraintOpts });
  const knee_L  = Constraint.create({ bodyA: thigh_L, pointA: { x: 0,   y: 22.5 }, bodyB: shin_L,  pointB: { x: 0, y: -22.5 }, ...constraintOpts });
  const hip_R   = Constraint.create({ bodyA: torso,   pointA: { x:  10, y: 30 },   bodyB: thigh_R, pointB: { x: 0, y: -22.5 }, ...constraintOpts });
  const knee_R  = Constraint.create({ bodyA: thigh_R, pointA: { x: 0,   y: 22.5 }, bodyB: shin_R,  pointB: { x: 0, y: -22.5 }, ...constraintOpts });

  const bodies      = [torso, thigh_L, shin_L, thigh_R, shin_R];
  const constraints = [hip_L, knee_L, hip_R, knee_R];

  World.add(world, [...bodies, ...constraints]);

  return {
    torso,
    thigh_L, shin_L,
    thigh_R, shin_R,
    constraints: { hip_L, knee_L, hip_R, knee_R },
    allBodies: bodies,
    allConstraints: constraints,
  };
}
