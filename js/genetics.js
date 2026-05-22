// Genome encoding: 8 real-valued genes controlling sinusoidal joint oscillators.
// Joints: hip_L, knee_L, hip_R, knee_R — each with (phase, amplitude).
// Index layout: [phase_hip_L, amp_hip_L, phase_knee_L, amp_knee_L,
//                phase_hip_R, amp_hip_R, phase_knee_R, amp_knee_R]

export const GENE_BOUNDS = [
  [0, Math.PI * 2],   // 0: phase_hip_L
  [0, Math.PI / 2],   // 1: amp_hip_L
  [0, Math.PI * 2],   // 2: phase_knee_L
  [0, Math.PI / 3],   // 3: amp_knee_L
  [0, Math.PI * 2],   // 4: phase_hip_R
  [0, Math.PI / 2],   // 5: amp_hip_R
  [0, Math.PI * 2],   // 6: phase_knee_R
  [0, Math.PI / 3],   // 7: amp_knee_R
  [0.3, 2.0],         // 8: stride_freq — oscillation speed multiplier (1.0=walk, 2.0=run)
];

export const POPULATION_SIZE = 150;
export const ELITE_COUNT     = 1;
export const MUTATION_RATE   = 0.25;
export const TOURNAMENT_K    = 2;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Box-Muller Gaussian sample
function gaussianRandom(sigma) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export class Genome {
  constructor(genes = null) {
    this.genes   = genes ?? Genome.random();
    this.fitness = 0;
  }

  static random() {
    return GENE_BOUNDS.map(([lo, hi]) => lo + Math.random() * (hi - lo));
  }

  // Seeds a genome with counter-phase leg pattern to bootstrap walking discovery.
  // phase_hip_R ≈ phase_hip_L + π is the key invariant for bipedal gait.
  static seededWalker() {
    const basePhase = Math.random() * 2 * Math.PI;
    const ampHip    = 0.3 + Math.random() * 0.5;
    const ampKnee   = 0.15 + Math.random() * 0.35;
    const freq      = 0.7 + Math.random() * 0.8;
    const raw = [
      basePhase,
      ampHip,
      (basePhase + Math.PI / 2 + (Math.random() - 0.5) * 0.8) % (2 * Math.PI),
      ampKnee,
      (basePhase + Math.PI) % (2 * Math.PI),
      ampHip * (0.8 + Math.random() * 0.4),
      (basePhase + 3 * Math.PI / 2) % (2 * Math.PI),
      ampKnee * (0.8 + Math.random() * 0.4),
      freq,
    ];
    return raw.map((v, i) => {
      const [lo, hi] = GENE_BOUNDS[i];
      return Math.max(lo, Math.min(hi, v));
    });
  }

  clone() { return new Genome([...this.genes]); }
}

export function tournamentSelect(population) {
  let best = null;
  for (let i = 0; i < TOURNAMENT_K; i++) {
    const candidate = population[Math.floor(Math.random() * population.length)];
    if (!best || candidate.fitness > best.fitness) best = candidate;
  }
  return best;
}

export function uniformCrossover(a, b) {
  const genes = a.genes.map((g, i) => (Math.random() < 0.5 ? g : b.genes[i]));
  return new Genome(genes);
}

// sigma is passed explicitly so population.js can use adaptive values per generation.
export function gaussianMutate(genome, sigma) {
  const genes = genome.genes.map((g, i) => {
    if (Math.random() < MUTATION_RATE) {
      g += gaussianRandom(sigma);
      g = clamp(g, GENE_BOUNDS[i][0], GENE_BOUNDS[i][1]);
    }
    return g;
  });
  return new Genome(genes);
}

export function initPopulation(size = POPULATION_SIZE) {
  return Array.from({ length: size }, (_, i) =>
    i < size / 2 ? new Genome(Genome.seededWalker()) : new Genome()
  );
}
