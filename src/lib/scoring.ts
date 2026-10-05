import type {
  SimulationState,
  ScenarioDefinition,
  IncidentScore,
  MissedSignal,
  DecisionRecord,
  SLOImpact,
  CustomerImpactResult,
  CostImpactResult,
  TakenAction,
} from '@/types';

export function calculateScore(
  state: SimulationState,
  scenario: ScenarioDefinition,
): IncidentScore {
  // MTTA: time from first alert to first action
  const mtta =
    state.firstAlertTime !== null && state.firstActionTime !== null
      ? Math.max(0, state.firstActionTime - state.firstAlertTime)
      : state.firstActionTime !== null
        ? state.firstActionTime
        : null;

  // MTTR: time from first alert to resolution
  const mttr =
    state.isResolved && state.firstAlertTime !== null && state.resolvedTime !== null
      ? Math.max(0, state.resolvedTime - state.firstAlertTime)
      : state.isFailed
        ? scenario.duration
        : null;

  // SLO Impact
  const sloImpact: SLOImpact = {
    errorBudgetBurned: state.errorBudgetBurned,
    budgetRemaining: Math.max(0, 100 - state.errorBudgetBurned),
    burnRate: state.errorBudgetBurned / (state.simTime / 3600 || 1),
    sloBreached: state.errorBudgetBurned >= 50,
  };

  // Customer Impact
  const peakAffectedPercent = Math.max(
    ...state.metricHistory.map((m) => {
      // Estimate from error rate since we track it in state
      return state.customerImpactPercent;
    }),
    state.customerImpactPercent,
  );
  const peakAffectedUsers = Math.round(
    (peakAffectedPercent / 100) * scenario.customerImpactModel.usersTotal,
  );
  const totalUserMinutes = Math.round(
    (peakAffectedUsers * state.simTime) / 60,
  );
  const revenueAtRisk =
    (peakAffectedPercent / 100) *
    scenario.customerImpactModel.revenuePerHour *
    (state.simTime / 3600);

  const customerImpact: CustomerImpactResult = {
    peakAffectedPercent,
    peakAffectedUsers,
    totalUserMinutes,
    revenueAtRisk,
  };

  // Cost Impact
  const infraCost =
    scenario.costModel.baseInfraCostPerHour * (state.simTime / 3600);
  const vendorCost = state.actionsTaken
    .filter((a) => a.actionId === 'escalate_vendor')
    .reduce((sum) => sum + scenario.costModel.vendorEscalationCost, 0);
  const scaleCost = state.actionsTaken
    .filter((a) => a.actionId === 'scale_service')
    .reduce((sum) => sum + scenario.costModel.scaleCostPerInstancePerHour * 5, 0);
  const businessCost =
    (peakAffectedPercent / 100) *
    scenario.costModel.businessCostPerDowntimeHour *
    (state.simTime / 3600);

  const costImpact: CostImpactResult = {
    infraCost,
    vendorCost,
    scaleCost,
    businessCost,
    total: state.totalCost,
  };

  // Missed signals: alerts that fired but were not acknowledged before action was taken
  const missedSignals: MissedSignal[] = [];
  for (const signal of scenario.signals) {
    const alert = state.alerts.find((a) => a.id === signal.id);
    if (!alert) continue;
    if (!alert.acknowledged) {
      missedSignals.push({
        signalId: signal.id,
        label: signal.label,
        revealedAtSimTime: alert.simTime,
        reason: 'Alert was not acknowledged before taking action',
      });
    }
  }

  // Also check for signals that fired but no action was taken within 3 ticks
  for (const signal of scenario.signals) {
    const alert = state.alerts.find((a) => a.id === signal.id);
    if (!alert) continue;
    const actionAfter = state.actionsTaken.find(
      (a) => a.takenAtTick >= alert.tick && a.takenAtTick <= alert.tick + 3,
    );
    if (!actionAfter && !missedSignals.find((ms) => ms.signalId === signal.id)) {
      missedSignals.push({
        signalId: signal.id,
        label: signal.label,
        revealedAtSimTime: alert.simTime,
        reason: 'No action was taken within a reasonable time of this alert',
      });
    }
  }

  // Helpful and harmful decisions
  const helpfulDecisions: DecisionRecord[] = [];
  const harmfulDecisions: DecisionRecord[] = [];

  for (const action of state.actionsTaken) {
    const isOptimal = scenario.optimalActionSequence.includes(action.actionId);
    const wasHelpful = action.helped && action.effect.resolutionProgressDelta > 0;

    if (wasHelpful || (isOptimal && action.effect.helpsRecovery)) {
      helpfulDecisions.push({
        actionId: action.actionId,
        label: action.label,
        takenAtSimTime: action.takenAtSimTime,
        reason: isOptimal
          ? 'This action is part of the optimal resolution sequence'
          : 'This action reduced error rate or improved metrics',
      });
    } else if (!action.effect.helpsRecovery && action.effect.resolutionProgressDelta === 0) {
      // Only flag as harmful if it didn't help at all and cost time/money
      const wastedCost = action.effect.costDelta;
      if (wastedCost > 0 || action.effect.riskDelta === 0) {
        harmfulDecisions.push({
          actionId: action.actionId,
          label: action.label,
          takenAtSimTime: action.takenAtSimTime,
          reason: 'This action did not contribute to resolution and wasted time or resources',
        });
      }
    }
  }

  // Actions that were needed but not taken
  for (const optimalId of scenario.optimalActionSequence) {
    const wasTaken = state.actionsTaken.some((a) => a.actionId === optimalId);
    if (!wasTaken) {
      harmfulDecisions.push({
        actionId: optimalId,
        label: getActionLabel(optimalId),
        takenAtSimTime: -1,
        reason: 'This action was part of the optimal sequence but was never taken',
      });
    }
  }

  // Runbook recommendations
  const runbookRecommendations = generateRecommendations(
    state,
    scenario,
    missedSignals,
    harmfulDecisions,
  );

  // Overall score calculation
  const overall = calculateOverallScore(
    state,
    scenario,
    mtta,
    mttr,
    sloImpact,
    customerImpact,
    costImpact,
    missedSignals.length,
    state.rootCauseDiagnosed,
  );

  const grade = scoreToGrade(overall);

  return {
    overall,
    grade,
    mtta,
    mttr,
    sloImpact,
    customerImpact,
    costImpact,
    missedSignals,
    helpfulDecisions,
    harmfulDecisions,
    runbookRecommendations,
    rootCauseFound: state.rootCauseDiagnosed,
  };
}

function getActionLabel(id: string): string {
  const labels: Record<string, string> = {
    rollback_release: 'Roll Back Release',
    scale_service: 'Scale Service',
    enable_kill_switch: 'Enable Feature Flag Kill Switch',
    failover_secondary: 'Fail Over to Secondary',
    increase_queue_workers: 'Increase Queue Workers',
    add_rate_limiting: 'Add Rate Limiting',
    escalate_vendor: 'Escalate to Vendor',
    readonly_mode: 'Put Site in Read-Only Mode',
    status_page: 'Communicate on Status Page',
    run_diagnostic: 'Run Diagnostic Query',
  };
  return labels[id] || id;
}

function calculateOverallScore(
  state: SimulationState,
  scenario: ScenarioDefinition,
  mtta: number | null,
  mttr: number | null,
  sloImpact: SLOImpact,
  customerImpact: CustomerImpactResult,
  costImpact: CostImpactResult,
  missedSignalCount: number,
  rootCauseFound: boolean,
): number {
  let score = 100;

  // Resolution status (biggest factor)
  if (state.isResolved) {
    // Bonus for resolving — but score depends on how well
    score = 80;
  } else if (state.isFailed) {
    score = 20;
  } else {
    score = 40; // incomplete
  }

  // MTTA scoring (faster is better, ideal < 120s, penalty after 300s)
  if (mtta !== null) {
    if (mtta <= 60) score += 8;
    else if (mtta <= 120) score += 5;
    else if (mtta <= 300) score += 2;
    else score -= 3;
  } else {
    score -= 5; // never took action
  }

  // MTTR scoring (faster is better)
  if (mttr !== null && state.isResolved) {
    if (mttr <= 300) score += 10;
    else if (mttr <= 600) score += 7;
    else if (mttr <= 900) score += 4;
    else score += 1;
  }

  // SLO impact
  score -= sloImpact.errorBudgetBurned * 0.15;

  // Customer impact
  score -= customerImpact.peakAffectedPercent * 0.2;

  // Cost impact (penalize excessive spending)
  if (costImpact.total > 5000) score -= 8;
  else if (costImpact.total > 2000) score -= 4;
  else if (costImpact.total > 1000) score -= 2;

  // Root cause diagnosis
  if (rootCauseFound) score += 10;
  else score -= 10;

  // Missed signals
  score -= missedSignalCount * 5;

  // Harmful decisions
  const harmfulCount = state.actionsTaken.filter(
    (a) => !a.helped && a.effect.resolutionProgressDelta === 0 && a.effect.costDelta > 0,
  ).length;
  score -= harmfulCount * 3;

  // Optimal sequence adherence bonus
  const optimalTaken = scenario.optimalActionSequence.filter((id) =>
    state.actionsTaken.some((a) => a.actionId === id),
  ).length;
  const optimalRatio = optimalTaken / scenario.optimalActionSequence.length;
  score += optimalRatio * 8;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreToGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function generateRecommendations(
  state: SimulationState,
  scenario: ScenarioDefinition,
  missedSignals: MissedSignal[],
  harmfulDecisions: DecisionRecord[],
): string[] {
  const recs: string[] = [];

  // Missed signal recommendations
  if (missedSignals.length > 0) {
    recs.push(
      `Add monitoring alerts for: ${missedSignals.map((s) => s.label).join(', ')}. Ensure these signals trigger automatic paging.`,
    );
  }

  // Root cause not found
  if (!state.rootCauseDiagnosed) {
    recs.push(
      `Always run diagnostics early. The root cause was: ${scenario.rootCause}. Train responders to identify the pattern: ${scenario.rootCauseHint}`,
    );
  }

  // Missing optimal actions
  const missingOptimal = scenario.optimalActionSequence.filter(
    (id) => !state.actionsTaken.some((a) => a.actionId === id),
  );
  if (missingOptimal.length > 0) {
    recs.push(
      `Add these steps to the runbook: ${missingOptimal.map(getActionLabel).join(' → ')}. These are critical for resolving this scenario type.`,
    );
  }

  // MTTA too slow
  if (state.firstActionTime !== null && state.firstAlertTime !== null) {
    const ackTime = state.firstActionTime - state.firstAlertTime;
    if (ackTime > 180) {
      recs.push(
        'MTTA is too high. Implement automated alert routing and on-call escalation policies to reduce time-to-action.',
      );
    }
  }

  // Status page communication
  const statusPosted = state.actionsTaken.some((a) => a.actionId === 'status_page');
  if (!statusPosted) {
    recs.push(
      'Always post a status page update early in the incident. This reduces customer support load and sets expectations.',
    );
  }

  // Excessive scaling without diagnosis
  const scaledWithoutDiagnosis =
    state.actionsTaken.some((a) => a.actionId === 'scale_service') &&
    !state.actionsTaken.some((a) => a.actionId === 'run_diagnostic');
  if (scaledWithoutDiagnosis) {
    recs.push(
      'Do not scale before diagnosing. Scaling without understanding the root cause wastes resources and may not help.',
    );
  }

  // Cost optimization
  if (state.totalCost > 3000) {
    recs.push(
      'Incident cost was high. Review whether all scaling and vendor escalation actions were necessary. Prefer targeted fixes over broad capacity changes.',
    );
  }

  // If no recommendations, add a positive one
  if (recs.length === 0) {
    recs.push(
      'Excellent response. The runbook for this scenario appears well-aligned with the optimal resolution path.',
    );
  }

  return recs;
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return 'N/A';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export function formatCurrency(amount: number): string {
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}k`;
  }
  return `$${Math.round(amount)}`;
}
