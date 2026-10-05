// Simple test runner for simulation state transitions and scoring logic.
// Run with: npx tsx src/lib/__tests__/run-tests.ts
import { createInitialState, advanceTick, applyAction } from '../simulation';
import { calculateScore, formatDuration, formatCurrency } from '../scoring';
import { SCENARIOS } from '../../data/scenarios';
import type { SimulationState, ScenarioDefinition } from '@/types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${message}`);
  }
}

function describe(name: string, fn: () => void): void {
  console.log(`\n${name}`);
  fn();
}

function it(name: string, fn: () => void): void {
  process.stdout.write(`  - ${name}: `);
  const beforeFail = failed;
  try {
    fn();
    if (failed === beforeFail) console.log('OK');
  } catch (e) {
    failed++;
    console.log('FAIL');
    console.error(`    ${(e as Error).message}`);
  }
}

// Helper: advance state to at least the given tick
function advanceToTick(state: SimulationState, scenario: ScenarioDefinition, tick: number): SimulationState {
  let s = state;
  while (s.tick < tick && !s.isFailed && !s.isResolved) {
    s = advanceTick(s, scenario);
  }
  return s;
}

// ============ Simulation State Transitions ============

describe('Simulation State Transitions', () => {
  it('creates initial state with correct defaults', () => {
    const scenario = SCENARIOS[0];
    const state = createInitialState(scenario);
    assert(state.tick === 0, 'tick should be 0');
    assert(state.simTime === 0, 'simTime should be 0');
    assert(state.isRunning === true, 'isRunning should be true');
    assert(state.isPaused === false, 'isPaused should be false');
    assert(state.isResolved === false, 'isResolved should be false');
    assert(state.isFailed === false, 'isFailed should be false');
    assert(state.rootCauseDiagnosed === false, 'rootCauseDiagnosed should be false');
    assert(state.resolutionProgress === 0, 'resolutionProgress should be 0');
    assert(state.actionsTaken.length === 0, 'actionsTaken should be empty');
    assert(state.metricHistory.length === 1, 'metricHistory should have 1 entry');
  });

  it('advances tick and simTime correctly', () => {
    const scenario = SCENARIOS[0];
    let state = createInitialState(scenario);
    state = advanceTick(state, scenario);
    assert(state.tick === 1, 'tick should be 1');
    assert(state.simTime === 30, 'simTime should be 30');
    state = advanceTick(state, scenario);
    assert(state.tick === 2, 'tick should be 2');
    assert(state.simTime === 60, 'simTime should be 60');
  });

  it('does not advance when paused', () => {
    const scenario = SCENARIOS[0];
    let state = createInitialState(scenario);
    state = { ...state, isPaused: true };
    state = advanceTick(state, scenario);
    assert(state.tick === 0, 'tick should remain 0');
  });

  it('does not advance when resolved', () => {
    const scenario = SCENARIOS[0];
    let state = createInitialState(scenario);
    state = { ...state, isResolved: true, isRunning: false };
    state = advanceTick(state, scenario);
    assert(state.tick === 0, 'tick should remain 0');
  });

  it('applies action and records it in actionsTaken', () => {
    const scenario = SCENARIOS[3]; // bad deployment
    let state = createInitialState(scenario);
    // status_page is available from tick 0
    state = applyAction(state, scenario, 'status_page');
    assert(state.actionsTaken.length === 1, 'should have 1 action');
    assert(state.actionsTaken[0].actionId === 'status_page', 'action should be status_page');
    assert(state.firstActionTime === 0, 'firstActionTime should be 0');
  });

  it('sets rootCauseDiagnosed when diagnostic action is taken', () => {
    const scenario = SCENARIOS[0];
    let state = createInitialState(scenario);
    // run_diagnostic available from tick 1
    state = advanceToTick(state, scenario, 1);
    state = applyAction(state, scenario, 'run_diagnostic');
    assert(state.rootCauseDiagnosed === true, 'rootCauseDiagnosed should be true');
  });

  it('resolves incident when resolutionProgress reaches 1', () => {
    const scenario = SCENARIOS[3]; // bad deployment
    let state = createInitialState(scenario);
    state = applyAction(state, scenario, 'status_page'); // tick 0, available from 0
    state = advanceToTick(state, scenario, 1);
    state = applyAction(state, scenario, 'run_diagnostic'); // tick 1, avail from 1, +0.25
    state = advanceToTick(state, scenario, 2);
    state = applyAction(state, scenario, 'rollback_release'); // tick 2, avail from 2, +0.5
    state = applyAction(state, scenario, 'enable_kill_switch'); // tick 2, avail from 2, +0.3
    // total: 0.25 + 0.5 + 0.3 = 1.05 -> clamped to 1 -> resolved
    assert(state.isResolved === true, 'should be resolved');
    assert(state.resolvedTime !== null, 'resolvedTime should be set');
    assert(state.isRunning === false, 'isRunning should be false');
  });

  it('prevents duplicate non-repeatable actions', () => {
    const scenario = SCENARIOS[3];
    let state = createInitialState(scenario);
    state = advanceToTick(state, scenario, 2);
    state = applyAction(state, scenario, 'rollback_release');
    assert(state.actionsTaken.length === 1, 'should have 1 action');
    state = applyAction(state, scenario, 'rollback_release');
    assert(state.actionsTaken.length === 1, 'should still have 1 action');
  });

  it('allows status_page to be taken multiple times', () => {
    const scenario = SCENARIOS[0];
    let state = createInitialState(scenario);
    state = applyAction(state, scenario, 'status_page');
    state = applyAction(state, scenario, 'status_page');
    assert(state.actionsTaken.length === 2, 'should have 2 actions');
  });

  it('accumulates cost when actions have cost', () => {
    const scenario = SCENARIOS[0];
    let state = createInitialState(scenario);
    const initialCost = state.totalCost;
    // scale_service available from tick 1
    state = advanceToTick(state, scenario, 1);
    state = applyAction(state, scenario, 'scale_service');
    assert(state.totalCost > initialCost, 'cost should increase');
  });

  it('does not allow actions before their availableFromTick', () => {
    const scenario = SCENARIOS[0];
    let state = createInitialState(scenario);
    // failover_secondary has availableFromTick: 3
    state = applyAction(state, scenario, 'failover_secondary');
    assert(state.actionsTaken.length === 0, 'should have 0 actions');
  });

  it('detects catastrophic failure conditions', () => {
    const scenario = SCENARIOS[0];
    let state = createInitialState(scenario);
    state = { ...state, currentMetrics: { ...state.currentMetrics, diskUsage: 100 } };
    state = advanceTick(state, scenario);
    assert(state.isFailed === true, 'should be failed');
  });
});

// ============ Scoring Logic ============

describe('Scoring Logic', () => {
  it('calculates a score for a resolved incident', () => {
    const scenario = SCENARIOS[3];
    let state = createInitialState(scenario);
    state = applyAction(state, scenario, 'status_page');
    state = advanceToTick(state, scenario, 1);
    state = applyAction(state, scenario, 'run_diagnostic');
    state = advanceToTick(state, scenario, 2);
    state = applyAction(state, scenario, 'rollback_release');
    state = applyAction(state, scenario, 'enable_kill_switch');
    const score = calculateScore(state, scenario);
    assert(score.overall >= 0 && score.overall <= 100, 'score should be 0-100');
    assert(/^[A-F]$/.test(score.grade), 'grade should be A-F');
  });

  it('calculates MTTA correctly', () => {
    const scenario = SCENARIOS[3];
    let state = createInitialState(scenario);
    state = advanceTick(state, scenario);
    state = advanceTick(state, scenario);
    state = applyAction(state, scenario, 'status_page');
    const score = calculateScore(state, scenario);
    assert(score.mtta !== null, 'mtta should not be null');
    assert((score.mtta ?? 0) >= 0, 'mtta should be >= 0');
  });

  it('calculates MTTR for resolved incidents', () => {
    const scenario = SCENARIOS[3];
    let state = createInitialState(scenario);
    state = applyAction(state, scenario, 'status_page');
    state = advanceToTick(state, scenario, 1);
    state = applyAction(state, scenario, 'run_diagnostic');
    state = advanceToTick(state, scenario, 2);
    state = applyAction(state, scenario, 'rollback_release');
    state = applyAction(state, scenario, 'enable_kill_switch');
    if (state.isResolved) {
      const score = calculateScore(state, scenario);
      assert(score.mttr !== null, 'mttr should not be null');
      assert((score.mttr ?? 0) >= 0, 'mttr should be >= 0');
    }
  });

  it('penalizes missed root cause diagnosis', () => {
    const scenario = SCENARIOS[3];
    let state = createInitialState(scenario);
    state = applyAction(state, scenario, 'status_page');
    state = advanceToTick(state, scenario, 2);
    state = applyAction(state, scenario, 'rollback_release');
    state = applyAction(state, scenario, 'enable_kill_switch');
    state = { ...state, isResolved: true, resolvedTime: 300, resolutionProgress: 1 };
    const score = calculateScore(state, scenario);
    assert(score.rootCauseFound === false, 'rootCauseFound should be false');
    assert(score.overall < 90, 'score should be < 90 without diagnosis');
  });

  it('generates runbook recommendations', () => {
    const scenario = SCENARIOS[3];
    let state = createInitialState(scenario);
    state = applyAction(state, scenario, 'status_page');
    state = { ...state, isResolved: true, resolvedTime: 300, resolutionProgress: 1 };
    const score = calculateScore(state, scenario);
    assert(score.runbookRecommendations.length > 0, 'should have recommendations');
  });

  it('identifies helpful decisions', () => {
    const scenario = SCENARIOS[3];
    let state = createInitialState(scenario);
    state = applyAction(state, scenario, 'status_page');
    state = advanceToTick(state, scenario, 1);
    state = applyAction(state, scenario, 'run_diagnostic');
    state = advanceToTick(state, scenario, 2);
    state = applyAction(state, scenario, 'rollback_release');
    state = { ...state, isResolved: true, resolvedTime: 300, resolutionProgress: 1 };
    const score = calculateScore(state, scenario);
    assert(score.helpfulDecisions.length > 0, 'should have helpful decisions');
  });

  it('identifies missing optimal actions as harmful', () => {
    const scenario = SCENARIOS[3];
    let state = createInitialState(scenario);
    state = applyAction(state, scenario, 'status_page');
    state = { ...state, isResolved: true, resolvedTime: 300, resolutionProgress: 1 };
    const score = calculateScore(state, scenario);
    assert(score.harmfulDecisions.length > 0, 'should have harmful decisions for missing optimal actions');
  });

  it('formatDuration formats correctly', () => {
    assert(formatDuration(0) === '0s', '0s');
    assert(formatDuration(45) === '45s', '45s');
    assert(formatDuration(60) === '1m 0s', '1m 0s');
    assert(formatDuration(125) === '2m 5s', '2m 5s');
    assert(formatDuration(null) === 'N/A', 'N/A');
  });

  it('formatCurrency formats correctly', () => {
    assert(formatCurrency(500) === '$500', '$500');
    assert(formatCurrency(1500) === '$1.5k', '$1.5k');
    assert(formatCurrency(25000) === '$25.0k', '$25.0k');
  });
});

// ============ Decision Consequence Engine ============

describe('Decision Consequence Engine', () => {
  it('rollback reduces error rate for bad deployment', () => {
    const scenario = SCENARIOS[3]; // bad deployment
    let state = createInitialState(scenario);
    const errorBefore = state.currentMetrics.errorRate;
    state = advanceToTick(state, scenario, 2); // rollback available from tick 2
    state = applyAction(state, scenario, 'rollback_release');
    assert(state.currentMetrics.errorRate < errorBefore, 'error rate should decrease');
  });

  it('rollback reduces memory for bad deployment', () => {
    const scenario = SCENARIOS[3];
    let state = createInitialState(scenario);
    const memBefore = state.currentMetrics.memoryUsage;
    state = advanceToTick(state, scenario, 2);
    state = applyAction(state, scenario, 'rollback_release');
    assert(state.currentMetrics.memoryUsage < memBefore, 'memory should decrease');
  });

  it('scale_service reduces CPU usage', () => {
    const scenario = SCENARIOS[7]; // traffic spike
    let state = createInitialState(scenario);
    const cpuBefore = state.currentMetrics.cpuUsage;
    state = advanceToTick(state, scenario, 1); // scale available from tick 1
    state = applyAction(state, scenario, 'scale_service');
    assert(state.currentMetrics.cpuUsage < cpuBefore, 'CPU should decrease');
  });

  it('increase_queue_workers reduces queue depth', () => {
    const scenario = SCENARIOS[4]; // queue backlog
    let state = createInitialState(scenario);
    const queueBefore = state.currentMetrics.queueDepth;
    state = advanceToTick(state, scenario, 1); // available from tick 1
    state = applyAction(state, scenario, 'increase_queue_workers');
    assert(state.currentMetrics.queueDepth < queueBefore, 'queue depth should decrease');
  });

  it('wrong actions do not help resolution', () => {
    const scenario = SCENARIOS[3]; // bad deployment
    let state = createInitialState(scenario);
    const progressBefore = state.resolutionProgress;
    state = advanceToTick(state, scenario, 3); // escalate_vendor available from tick 3
    state = applyAction(state, scenario, 'escalate_vendor');
    assert(state.resolutionProgress === progressBefore, 'progress should not change');
  });

  it('metric evolution increases error rate over time without intervention', () => {
    const scenario = SCENARIOS[0];
    let state = createInitialState(scenario);
    const errorAtStart = state.currentMetrics.errorRate;
    for (let i = 0; i < 10; i++) {
      state = advanceTick(state, scenario);
    }
    assert(state.currentMetrics.errorRate > errorAtStart, 'error rate should increase over time');
  });

  it('resolution progress causes metrics to decay toward healthy', () => {
    const scenario = SCENARIOS[3];
    let state = createInitialState(scenario);
    state = advanceToTick(state, scenario, 1);
    state = applyAction(state, scenario, 'run_diagnostic');
    state = advanceToTick(state, scenario, 2);
    state = applyAction(state, scenario, 'rollback_release');
    const errorAfterActions = state.currentMetrics.errorRate;
    state = advanceTick(state, scenario);
    assert(state.currentMetrics.errorRate <= errorAfterActions + 1, 'error should not increase much with resolution progress');
  });
});

// ============ Results ============

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
