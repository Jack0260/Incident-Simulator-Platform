import type {
  SimulationState,
  ScenarioDefinition,
  TakenAction,
  ActionId,
  MetricSnapshot,
  MetricKey,
  AlertEvent,
  LogEntry,
  Severity,
} from '@/types';

const TICK_SECONDS = 30; // each tick = 30 simulated seconds

let idCounter = 0;
function uid(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function createInitialState(
  scenario: ScenarioDefinition,
): SimulationState {
  const initialMetrics: MetricSnapshot = {
    tick: 0,
    simTime: 0,
    ...scenario.initialMetrics,
  };

  return {
    scenarioId: scenario.id,
    tick: 0,
    simTime: 0,
    isRunning: true,
    isPaused: false,
    isResolved: false,
    isFailed: false,
    currentMetrics: initialMetrics,
    metricHistory: [initialMetrics],
    alerts: [],
    logs: [],
    actionsTaken: [],
    riskScore: 30,
    rootCauseDiagnosed: false,
    resolutionProgress: 0,
    customerImpactPercent: scenario.customerImpactModel.initialAffectedPercent,
    totalCost: 0,
    errorBudgetBurned: 0,
    firstAlertTime: null,
    firstActionTime: null,
    resolvedTime: null,
    startTime: Date.now(),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function applyMetricEvolution(
  state: SimulationState,
  scenario: ScenarioDefinition,
): void {
  const metrics = state.currentMetrics;
  const tickCount = state.tick;

  for (const rule of scenario.metricEvolution) {
    const current = metrics[rule.metricKey];
    const elapsed = tickCount;

    // If resolution is in progress, decay metrics toward healthy
    if (state.resolutionProgress > 0) {
      const decay = rule.decayAfterResolution * state.resolutionProgress;
      (metrics as unknown as Record<string, number>)[rule.metricKey] = clamp(
        current + decay,
        rule.min,
        rule.max,
      );
    } else {
      // Natural evolution: base rate + acceleration over time
      const acceleration = rule.accelerationFactor * elapsed * 0.01;
      const change = rule.baseRate + acceleration;
      (metrics as unknown as Record<string, number>)[rule.metricKey] = clamp(
        current + change,
        rule.min,
        rule.max,
      );
    }
  }

  // Derive error budget burn from error rate and availability
  const errorContribution = metrics.errorRate * 0.5;
  const availabilityDeficit = Math.max(0, 100 - metrics.availability);
  state.errorBudgetBurned = clamp(
    state.errorBudgetBurned + errorContribution * 0.1 + availabilityDeficit * 0.05,
    0,
    100,
  );
  metrics.errorBudgetBurn = state.errorBudgetBurned;

  // Derive availability from error rate
  metrics.availability = clamp(100 - metrics.errorRate * 0.8, 80, 100);

  // Update customer impact
  if (state.resolutionProgress > 0) {
    state.customerImpactPercent = clamp(
      state.customerImpactPercent - state.resolutionProgress * 2,
      0,
      scenario.customerImpactModel.maxAffectedPercent,
    );
  } else {
    state.customerImpactPercent = clamp(
      state.customerImpactPercent + scenario.customerImpactModel.impactGrowthRate,
      0,
      scenario.customerImpactModel.maxAffectedPercent,
    );
  }
}

function generateLogs(
  state: SimulationState,
  scenario: ScenarioDefinition,
): LogEntry[] {
  const newLogs: LogEntry[] = [];
  for (const gen of scenario.logGenerators) {
    if (state.tick % gen.interval !== 0) continue;
    const template = gen.templates[state.tick % gen.templates.length];
    const message = template
      .replace('{pool}', String(Math.round(state.currentMetrics.connectionPool)))
      .replace('{lat}', String(Math.round(state.currentMetrics.latencyP95)))
      .replace('{dur}', String(Math.round(state.currentMetrics.latencyP99)))
      .replace('{depth}', String(Math.round(state.currentMetrics.queueDepth)))
      .replace('{mem}', String(Math.round(state.currentMetrics.memoryUsage)))
      .replace('{pct}', String(Math.round(state.currentMetrics.diskUsage)))
      .replace('{cpu}', String(Math.round(state.currentMetrics.cpuUsage)))
      .replace('{rps}', String(Math.round(state.currentMetrics.throughput)))
      .replace('{free}', String(Math.round((100 - state.currentMetrics.diskUsage) * 0.5)))
      .replace('{lag}', String(Math.round(state.currentMetrics.queueDepth / 100)))
      .replace('{rate}', String(Math.round(state.currentMetrics.throughput / 50)))
      .replace('{n}', String(state.tick))
      .replace('{id}', String(state.tick))
      .replace('{date}', new Date().toISOString().split('T')[0])
      .replace('{rev}', String(1000 + state.tick))
      .replace('{pause}', String(Math.round(state.currentMetrics.latencyP95 / 10)))
      .replace('{service}', 'downstream-svc')
      .replace('{file}', `/var/log/app/app-${state.tick}.log`)
      .replace('{size}', String(Math.round(state.tick * 0.5)))
      .replace('{target}', String(20))
      .replace('{actual}', String(Math.round(10 + state.tick / 5)))
      .replace('{pod}', `app-pod-${(state.tick % 5) + 1}`)
      .replace('{cur}', String(Math.round(8 + state.tick / 10)))
      .replace('{lat}', String(Math.round(state.currentMetrics.latencyP95)));

    newLogs.push({
      id: uid('log'),
      tick: state.tick,
      simTime: state.simTime,
      level: gen.level,
      source: gen.source,
      message,
    });
  }
  return newLogs;
}

function checkAlerts(
  state: SimulationState,
  scenario: ScenarioDefinition,
): AlertEvent[] {
  const newAlerts: AlertEvent[] = [];
  for (const sched of scenario.alertSchedule) {
    if (sched.atTick === state.tick) {
      const alert: AlertEvent = {
        id: sched.id,
        tick: state.tick,
        simTime: state.simTime,
        severity: sched.severity,
        source: sched.source,
        message: sched.message,
        acknowledged: false,
      };
      newAlerts.push(alert);
      if (state.firstAlertTime === null) {
        state.firstAlertTime = state.simTime;
      }
    }
  }

  // Also generate dynamic alerts based on metric thresholds
  for (const signal of scenario.signals) {
    if (signal.revealedAtTick === state.tick) {
      const value = state.currentMetrics[signal.metricKey];
      const threshold = signal.threshold;
      const isTriggered =
        signal.metricKey === 'availability' || signal.metricKey === 'throughput'
          ? value < threshold
          : value > threshold;

      if (isTriggered) {
        const existing = state.alerts.find((a) => a.id === signal.id);
        if (!existing) {
          newAlerts.push({
            id: signal.id,
            tick: state.tick,
            simTime: state.simTime,
            severity: signal.severity,
            source: signal.source || 'signal-monitor',
            message: signal.label,
            acknowledged: false,
          });
          if (state.firstAlertTime === null) {
            state.firstAlertTime = state.simTime;
          }
        }
      }
    }
  }

  return newAlerts;
}

function updateRiskScore(
  state: SimulationState,
  scenario: ScenarioDefinition,
): void {
  const m = state.currentMetrics;
  let risk = 0;

  risk += m.errorRate * 1.5;
  risk += m.cpuUsage > 90 ? 15 : m.cpuUsage > 80 ? 8 : 0;
  risk += m.memoryUsage > 90 ? 15 : m.memoryUsage > 80 ? 8 : 0;
  risk += m.diskUsage > 95 ? 20 : m.diskUsage > 90 ? 12 : 0;
  risk += m.connectionPool > 95 ? 15 : m.connectionPool > 85 ? 8 : 0;
  risk += m.latencyP95 > 2000 ? 15 : m.latencyP95 > 1000 ? 8 : 0;
  risk += m.queueDepth > 20000 ? 15 : m.queueDepth > 10000 ? 8 : 0;
  risk += m.availability < 95 ? 15 : m.availability < 98 ? 8 : 0;
  risk += state.customerImpactPercent > 50 ? 15 : state.customerImpactPercent > 30 ? 8 : 0;
  risk -= state.resolutionProgress * 40;
  risk -= state.rootCauseDiagnosed ? 10 : 0;

  state.riskScore = clamp(risk, 0, 100);
}

export function applyAction(
  state: SimulationState,
  scenario: ScenarioDefinition,
  actionId: ActionId,
): SimulationState {
  const actionDef = scenario.availableActions.find((a) => a.id === actionId);
  if (!actionDef) return state;
  if (state.tick < actionDef.availableFromTick) return state;
  if (state.isResolved || state.isFailed) return state;

  // Check if already taken (non-repeatable except status_page and run_diagnostic)
  const alreadyTaken = state.actionsTaken.some(
    (a) => a.actionId === actionId && actionId !== 'status_page' && actionId !== 'run_diagnostic',
  );
  if (alreadyTaken) return state;

  const effect = scenario.actionEffects[actionId];
  if (!effect) return state;

  const newState: SimulationState = {
    ...state,
    currentMetrics: { ...state.currentMetrics },
    actionsTaken: [...state.actionsTaken],
    alerts: [...state.alerts],
    logs: [...state.logs],
    metricHistory: [...state.metricHistory],
  };

  // Apply metric deltas
  for (const [key, delta] of Object.entries(effect.metricDeltas)) {
    const mk = key as MetricKey;
    const current = newState.currentMetrics[mk] as number;
    (newState.currentMetrics as unknown as Record<string, number>)[mk] = current + (delta as number);
  }

  // Apply cost
  newState.totalCost += actionDef.cost + effect.costDelta;

  // Apply resolution progress
  newState.resolutionProgress = clamp(
    newState.resolutionProgress + effect.resolutionProgressDelta,
    0,
    1,
  );

  // Reduce customer impact
  newState.customerImpactPercent = clamp(
    newState.customerImpactPercent - effect.customerImpactReduction * 10,
    0,
    100,
  );

  // Diagnose root cause
  if (actionId === scenario.diagnosticActionId) {
    newState.rootCauseDiagnosed = true;
  }

  // Track action
  const takenAction: TakenAction = {
    actionId,
    label: actionDef.label,
    takenAtTick: state.tick,
    takenAtSimTime: state.simTime,
    effect,
    helped: effect.helpsRecovery,
  };
  newState.actionsTaken.push(takenAction);

  if (newState.firstActionTime === null) {
    newState.firstActionTime = state.simTime;
  }

  // Log the action
  newState.logs.push({
    id: uid('log'),
    tick: state.tick,
    simTime: state.simTime,
    level: 'INFO',
    source: 'responder',
    message: `Action executed: ${actionDef.label}`,
  });

  // Check resolution
  if (newState.resolutionProgress >= 1) {
    newState.isResolved = true;
    newState.isRunning = false;
    newState.resolvedTime = state.simTime;
    newState.riskScore = 0;
    newState.currentMetrics.errorRate = 0;
    newState.currentMetrics.availability = 100;
    newState.customerImpactPercent = 0;
  }

  // Check failure conditions
  checkFailure(newState);

  return newState;
}

function checkFailure(state: SimulationState): void {
  if (state.isResolved) return;

  const m = state.currentMetrics;
  const catastrophic =
    m.diskUsage >= 100 ||
    m.memoryUsage >= 100 ||
    m.connectionPool >= 100 ||
    m.availability < 85 ||
    state.customerImpactPercent >= 80 ||
    state.errorBudgetBurned >= 100;

  if (catastrophic) {
    state.isFailed = true;
    state.isRunning = false;
    state.riskScore = 100;
  }
}

export function advanceTick(
  state: SimulationState,
  scenario: ScenarioDefinition,
): SimulationState {
  if (!state.isRunning || state.isPaused || state.isResolved || state.isFailed) {
    return state;
  }

  const newState: SimulationState = {
    ...state,
    currentMetrics: { ...state.currentMetrics },
    actionsTaken: [...state.actionsTaken],
    alerts: [...state.alerts],
    logs: [...state.logs],
    metricHistory: [...state.metricHistory],
  };

  newState.tick += 1;
  newState.simTime = newState.tick * TICK_SECONDS;

  // Evolve metrics
  applyMetricEvolution(newState, scenario);

  // Update metric history (keep last 100 entries for charting)
  const snapshot: MetricSnapshot = {
    ...newState.currentMetrics,
    tick: newState.tick,
    simTime: newState.simTime,
  };
  newState.metricHistory.push(snapshot);
  if (newState.metricHistory.length > 100) {
    newState.metricHistory.shift();
  }
  newState.currentMetrics = snapshot;

  // Generate logs
  const newLogs = generateLogs(newState, scenario);
  newState.logs.push(...newLogs);
  if (newState.logs.length > 200) {
    newState.logs = newState.logs.slice(-200);
  }

  // Check alerts
  const newAlerts = checkAlerts(newState, scenario);
  newState.alerts.push(...newAlerts);

  // Accumulate cost (base infra cost per tick)
  const tickHours = TICK_SECONDS / 3600;
  newState.totalCost += scenario.costModel.baseInfraCostPerHour * tickHours;

  // Add business cost based on customer impact
  const affectedUsers = newState.customerImpactPercent / 100 * scenario.customerImpactModel.usersTotal;
  newState.totalCost += scenario.costModel.businessCostPerDowntimeHour * tickHours * (affectedUsers / scenario.customerImpactModel.usersTotal);

  // Update risk
  updateRiskScore(newState, scenario);

  // Check failure
  checkFailure(newState);

  // Check if time exceeded
  if (newState.simTime >= scenario.duration && !newState.isResolved) {
    newState.isFailed = true;
    newState.isRunning = false;
  }

  return newState;
}

export function acknowledgeAlert(
  state: SimulationState,
  alertId: string,
): SimulationState {
  return {
    ...state,
    alerts: state.alerts.map((a) =>
      a.id === alertId
        ? { ...a, acknowledged: true, acknowledgedAt: state.simTime }
        : a,
    ),
  };
}

export function pauseSimulation(state: SimulationState): SimulationState {
  return { ...state, isPaused: true };
}

export function resumeSimulation(state: SimulationState): SimulationState {
  return { ...state, isPaused: false };
}

export const TICK_DURATION_SECONDS = TICK_SECONDS;

export function formatSimTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

export function getSeverityColor(severity: Severity): string {
  switch (severity) {
    case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/30';
    case 'warning': return 'text-amber-500 bg-amber-500/10 border-amber-500/30';
    case 'info': return 'text-blue-500 bg-blue-500/10 border-blue-500/30';
    case 'resolved': return 'text-green-500 bg-green-500/10 border-green-500/30';
    default: return 'text-gray-500 bg-gray-500/10 border-gray-500/30';
  }
}
