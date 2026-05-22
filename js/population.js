// Generational GA lifecycle split into discrete synchronous steps
// so the RAF loop in main.js can call them without blocking.

import { simulate } from './simulator.js';
import {
  Genome,
  initPopulation,
  tournamentSelect,
  uniformCrossover,
  gaussianMutate,
  POPULATION_SIZE,
  ELITE_COUNT,
} from './genetics.js';

export { POPULATION_SIZE };

// Dynamic sigma based on population diversity (Coefficient of Variation of fitness).
// Low CV (converged) → high sigma (diversify). High CV (diverse) → low sigma (exploit).
function dynamicSigma(pop) {
  const fitnesses = pop.map(g => g.fitness);
  const mean = fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length;
  if (mean < 1) return 0.9;
  const variance = fitnesses.reduce((s, v) => s + (v - mean) ** 2, 0) / fitnesses.length;
  const cv = Math.sqrt(variance) / mean;
  const diversity = Math.min(1, cv);
  return 0.15 + 0.75 * (1 - diversity);
}

const STAGNATION_WINDOW    = 7;
const STAGNATION_THRESHOLD = 3;
const OBSTACLE_THRESHOLD   = 1000;

export class Population {
  constructor(size = POPULATION_SIZE) {
    this.size = size;
    this._init();
  }

  _init() {
    this.generation     = 0;
    this.individuals    = initPopulation(this.size);
    this.bestGenome     = null;
    this.bestFitness    = 0;
    this.avgFitness     = 0;
    this.fitnessHistory = [];
    this.stagnating     = false;
    this._stagnationInjects = 0;
    this.currentSigma   = 0.9;
    this.obstacleMode   = false;
  }

  // Injection counts scale with population size (~23% total, 57% seeded)
  get _injectTotal()  { return Math.max(5,  Math.floor(this.size * 0.23)); }
  get _injectSeeded() { return Math.floor(this._injectTotal * 0.57); }
  get _injectRandom() { return this._injectTotal - this._injectSeeded; }

  evaluateOne(index) {
    this.individuals[index].fitness = simulate(this.individuals[index], this.obstacleMode);
  }

  finalize() {
    const pop = this.individuals;
    pop.sort((a, b) => b.fitness - a.fitness);

    this.bestFitness = pop[0].fitness;
    this.avgFitness  = pop.reduce((s, g) => s + g.fitness, 0) / pop.length;
    this.bestGenome  = pop[0].clone();
    this.generation++;

    this.fitnessHistory.push(this.bestFitness);
    if (this.fitnessHistory.length > 200) this.fitnessHistory.shift();

    if (!this.obstacleMode && this.bestFitness >= OBSTACLE_THRESHOLD) {
      this.obstacleMode = true;
    }

    if (this.fitnessHistory.length >= STAGNATION_WINDOW) {
      const win = this.fitnessHistory.slice(-STAGNATION_WINDOW);
      const improvement = Math.max(...win) - Math.min(...win);
      this.stagnating = improvement < STAGNATION_THRESHOLD;
    }
  }

  breedNext() {
    const pop   = this.individuals;
    const sigma = dynamicSigma(this.individuals);
    this.currentSigma = sigma;
    const next  = pop.slice(0, ELITE_COUNT).map(g => g.clone());

    if (this.stagnating) {
      this._stagnationInjects++;
      this.stagnating = false;
      const injectTotal  = this._injectTotal;
      const injectSeeded = this._injectSeeded;
      const injectRandom = this._injectRandom;

      while (next.length < this.size - injectTotal) {
        const parentA = tournamentSelect(pop);
        const parentB = tournamentSelect(pop);
        let child = uniformCrossover(parentA, parentB);
        child = gaussianMutate(child, sigma * 1.5);
        next.push(child);
      }
      for (let i = 0; i < injectSeeded; i++) {
        next.push(new Genome(Genome.seededWalker()));
      }
      for (let i = 0; i < injectRandom; i++) {
        next.push(new Genome());
      }
    } else {
      while (next.length < this.size) {
        const parentA = tournamentSelect(pop);
        const parentB = tournamentSelect(pop);
        let child = uniformCrossover(parentA, parentB);
        child = gaussianMutate(child, sigma);
        next.push(child);
      }
    }

    this.individuals = next;
  }

  get isStagnating() { return this.stagnating; }

  reset(newSize) {
    if (newSize !== undefined) this.size = newSize;
    this._init();
  }
}
