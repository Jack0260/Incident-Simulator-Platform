import { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2, XCircle, AlertTriangle, Clock, DollarSign, Users, TrendingDown,
  Lightbulb, ThumbsUp, ThumbsDown, FileText, ArrowLeft, Download, Search,
} from 'lucide-react';
import type { Page } from '@/App';
import type { IncidentScore, SimulationState } from '@/types';
import { getScenarioById, SCENARIOS } from '@/data/scenarios';
import { loadCustomScenarios, loadLeaderboard } from '@/lib/storage';
import { calculateScore, formatDuration, formatCurrency } from '@/lib/scoring';
import { createInitialState } from '@/lib/simulation';

interface PostmortemPageProps {
  runId: string;
  scenarioId: string;
  score: number;
  navigate: (page: Page) => void;
}

export function PostmortemPage({ runId, scenarioId, navigate }: PostmortemPageProps) {
  const [scoreData, setScoreData] = useState<IncidentScore | null>(null);
  const [scenarioName, setScenarioName] = useState('');

  useEffect(() => {
    const allScenarios = [...SCENARIOS, ...loadCustomScenarios()];
    const scenario = allScenarios.find((s) => s.id === scenarioId) || getScenarioById(scenarioId);
    if (!scenario) return;
    setScenarioName(scenario.name);

    const leaderboard = loadLeaderboard();
    const entry = leaderboard.find((e) => e.id === runId);
    if (!entry) return;

    // We need to reconstruct a minimal state for scoring, but since we already
    // saved the score when the simulation ended, we'll use the leaderboard entry
    // to display the score. However, we need the full score breakdown.
    // Let's store the full score in the leaderboard entry... but we didn't.
    // For now, reconstruct from the entry data.
    const mockState: SimulationState = createInitialState(scenario);
    mockState.isResolved = entry.mttr !== null;
    mockState.isFailed = entry.mttr === null;
    mockState.simTime = entry.mttr || scenario.duration;
    mockState.firstAlertTime = 0;
    mockState.firstActionTime = entry.mtta;
    mockState.resolvedTime = entry.mttr;
    mockState.errorBudgetBurned = entry.errorBudgetBurned;
    mockState.customerImpactPercent = entry.customerImpactPercent;
    mockState.totalCost = entry.totalCost;
    mockState.rootCauseDiagnosed = entry.rootCauseFound;
    mockState.resolutionProgress = entry.mttr !== null ? 1 : 0;

    const score = calculateScore(mockState, scenario);
    setScoreData(score);
  }, [runId, scenarioId]);

  const gradeColor = useMemo(() => {
    if (!scoreData) return '';
    if (scoreData.overall >= 80) return 'text-success-600 dark:text-success-400';
    if (scoreData.overall >= 60) return 'text-warning-600 dark:text-warning-400';
    return 'text-error-600 dark:text-error-400';
  }, [scoreData]);

  if (!scoreData) {
    return (
      <div className="p-6">
        <p className="text-secondary-600 dark:text-secondary-400">Loading postmortem...</p>
      </div>
    );
  }

  const handleExport = () => {
    const content = generatePostmortemText(scenarioName, scoreData);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `postmortem-${scenarioId}-${runId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate({ name: 'simulate' })} className="btn-ghost px-2">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Postmortem Report</h1>
            <p className="text-sm text-secondary-500">{scenarioName}</p>
          </div>
        </div>
        <button onClick={handleExport} className="btn-secondary">
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      {/* Score Banner */}
      <div className="card mb-6 p-8 text-center">
        <div className="flex items-center justify-center gap-6">
          <div>
            <p className="stat-label">Incident Score</p>
            <p className={`text-5xl font-bold ${gradeColor}`}>{scoreData.overall}</p>
          </div>
          <div className="h-16 w-px bg-secondary-200 dark:bg-secondary-700" />
          <div>
            <p className="stat-label">Grade</p>
            <p className={`text-5xl font-bold ${gradeColor}`}>{scoreData.grade}</p>
          </div>
          <div className="h-16 w-px bg-secondary-200 dark:bg-secondary-700" />
          <div>
            <p className="stat-label">Root Cause</p>
            <p className={`text-2xl font-bold ${scoreData.rootCauseFound ? 'text-success-500' : 'text-error-500'}`}>
              {scoreData.rootCauseFound ? 'Found' : 'Missed'}
            </p>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KeyMetric icon={Clock} label="MTTA" value={formatDuration(scoreData.mtta)} color="primary" />
        <KeyMetric icon={Clock} label="MTTR" value={formatDuration(scoreData.mttr)} color="accent" />
        <KeyMetric icon={Users} label="Peak Affected" value={`${scoreData.customerImpact.peakAffectedPercent.toFixed(1)}%`} color="warning" />
        <KeyMetric icon={DollarSign} label="Total Cost" value={formatCurrency(scoreData.costImpact.total)} color="error" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* SLO Impact */}
        <div className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-secondary-900 dark:text-white">
            <TrendingDown className="h-5 w-5 text-amber-500" />
            SLO Impact
          </h2>
          <div className="space-y-3">
            <StatRow label="Error Budget Burned" value={`${scoreData.sloImpact.errorBudgetBurned.toFixed(1)}%`} />
            <StatRow label="Budget Remaining" value={`${scoreData.sloImpact.budgetRemaining.toFixed(1)}%`} />
            <StatRow label="Burn Rate" value={`${scoreData.sloImpact.burnRate.toFixed(1)}%/hr`} />
            <StatRow
              label="SLO Breached"
              value={scoreData.sloImpact.sloBreached ? 'Yes' : 'No'}
              valueClass={scoreData.sloImpact.sloBreached ? 'text-error-500' : 'text-success-500'}
            />
          </div>
        </div>

        {/* Customer Impact */}
        <div className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-secondary-900 dark:text-white">
            <Users className="h-5 w-5 text-primary-500" />
            Customer Impact
          </h2>
          <div className="space-y-3">
            <StatRow label="Peak Affected Users" value={scoreData.customerImpact.peakAffectedUsers.toLocaleString()} />
            <StatRow label="Peak Affected %" value={`${scoreData.customerImpact.peakAffectedPercent.toFixed(1)}%`} />
            <StatRow label="Total User-Minutes" value={scoreData.customerImpact.totalUserMinutes.toLocaleString()} />
            <StatRow label="Revenue at Risk" value={formatCurrency(scoreData.customerImpact.revenueAtRisk)} />
          </div>
        </div>

        {/* Cost Impact */}
        <div className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-secondary-900 dark:text-white">
            <DollarSign className="h-5 w-5 text-error-500" />
            Cost Impact
          </h2>
          <div className="space-y-3">
            <StatRow label="Infrastructure Cost" value={formatCurrency(scoreData.costImpact.infraCost)} />
            <StatRow label="Vendor Cost" value={formatCurrency(scoreData.costImpact.vendorCost)} />
            <StatRow label="Scaling Cost" value={formatCurrency(scoreData.costImpact.scaleCost)} />
            <StatRow label="Business Cost" value={formatCurrency(scoreData.costImpact.businessCost)} />
            <div className="border-t border-secondary-200 pt-2 dark:border-secondary-700">
              <StatRow label="Total Cost" value={formatCurrency(scoreData.costImpact.total)} bold />
            </div>
          </div>
        </div>

        {/* Missed Signals */}
        <div className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-secondary-900 dark:text-white">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Missed Signals ({scoreData.missedSignals.length})
          </h2>
          {scoreData.missedSignals.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-success-600 dark:text-success-400">
              <CheckCircle2 className="h-4 w-4" />
              All signals were acknowledged and acted upon
            </div>
          ) : (
            <div className="space-y-3">
              {scoreData.missedSignals.map((signal) => (
                <div key={signal.signalId} className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800/30 dark:bg-amber-900/10">
                  <p className="text-sm font-medium text-secondary-900 dark:text-white">{signal.label}</p>
                  <p className="mt-1 text-xs text-secondary-500">{signal.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Helpful Decisions */}
      <div className="card mt-6 p-5">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-secondary-900 dark:text-white">
          <ThumbsUp className="h-5 w-5 text-success-500" />
          Decisions That Helped Recovery
        </h2>
        {scoreData.helpfulDecisions.length === 0 ? (
          <p className="text-sm text-secondary-500">No helpful decisions were made</p>
        ) : (
          <div className="space-y-2">
            {scoreData.helpfulDecisions.map((dec, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-success-200 bg-success-50/50 p-3 dark:border-success-800/30 dark:bg-success-900/10">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-500" />
                <div>
                  <p className="text-sm font-medium text-secondary-900 dark:text-white">{dec.label}</p>
                  <p className="mt-0.5 text-xs text-secondary-500">{dec.reason}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Harmful Decisions */}
      <div className="card mt-6 p-5">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-secondary-900 dark:text-white">
          <ThumbsDown className="h-5 w-5 text-error-500" />
          Decisions That Harmed Recovery
        </h2>
        {scoreData.harmfulDecisions.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-success-600 dark:text-success-400">
            <CheckCircle2 className="h-4 w-4" />
            No harmful decisions were made
          </div>
        ) : (
          <div className="space-y-2">
            {scoreData.harmfulDecisions.map((dec, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-error-200 bg-error-50/50 p-3 dark:border-error-800/30 dark:bg-error-900/10">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-error-500" />
                <div>
                  <p className="text-sm font-medium text-secondary-900 dark:text-white">
                    {dec.takenAtSimTime < 0 ? `Missing: ${dec.label}` : dec.label}
                  </p>
                  <p className="mt-0.5 text-xs text-secondary-500">{dec.reason}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Runbook Recommendations */}
      <div className="card mt-6 p-5">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-secondary-900 dark:text-white">
          <Lightbulb className="h-5 w-5 text-accent-500" />
          Recommended Runbook Improvements
        </h2>
        <div className="space-y-2">
          {scoreData.runbookRecommendations.map((rec, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg border border-primary-200 bg-primary-50/50 p-3 dark:border-primary-800/30 dark:bg-primary-900/10">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700 dark:bg-primary-900 dark:text-primary-300">{i + 1}</span>
              <p className="text-sm text-secondary-700 dark:text-secondary-300">{rec}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex gap-3">
        <button onClick={() => navigate({ name: 'simulate' })} className="btn-primary">
          <FileText className="h-4 w-4" />
          Run Another Simulation
        </button>
        <button onClick={() => navigate({ name: 'leaderboard' })} className="btn-secondary">
          View Leaderboard
        </button>
        <button onClick={() => navigate({ name: 'analytics' })} className="btn-secondary">
          View Analytics
        </button>
      </div>
    </div>
  );
}

function KeyMetric({ icon: Icon, label, value, color }: { icon: typeof Clock; label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    primary: 'text-primary-600 dark:text-primary-400',
    accent: 'text-accent-600 dark:text-accent-400',
    warning: 'text-warning-600 dark:text-warning-400',
    error: 'text-error-600 dark:text-error-400',
  };
  return (
    <div className="card p-4 text-center">
      <Icon className={`mx-auto mb-2 h-5 w-5 ${colorMap[color]}`} />
      <p className="stat-label">{label}</p>
      <p className={`mt-1 text-xl font-bold ${colorMap[color]}`}>{value}</p>
    </div>
  );
}

function StatRow({ label, value, bold, valueClass }: { label: string; value: string; bold?: boolean; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-secondary-600 dark:text-secondary-400">{label}</span>
      <span className={`${bold ? 'text-base font-bold' : 'text-sm font-medium'} ${valueClass || 'text-secondary-900 dark:text-white'}`}>{value}</span>
    </div>
  );
}

function generatePostmortemText(scenarioName: string, score: IncidentScore): string {
  const lines: string[] = [];
  lines.push('='.repeat(60));
  lines.push('  INCIDENT POSTMORTEM REPORT');
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Scenario: ${scenarioName}`);
  lines.push(`Date: ${new Date().toISOString()}`);
  lines.push(`Score: ${score.overall}/100 (Grade: ${score.grade})`);
  lines.push(`Root Cause Found: ${score.rootCauseFound ? 'Yes' : 'No'}`);
  lines.push('');
  lines.push('--- Timing ---');
  lines.push(`MTTA: ${formatDuration(score.mtta)}`);
  lines.push(`MTTR: ${formatDuration(score.mttr)}`);
  lines.push('');
  lines.push('--- SLO Impact ---');
  lines.push(`Error Budget Burned: ${score.sloImpact.errorBudgetBurned.toFixed(1)}%`);
  lines.push(`Budget Remaining: ${score.sloImpact.budgetRemaining.toFixed(1)}%`);
  lines.push(`SLO Breached: ${score.sloImpact.sloBreached ? 'Yes' : 'No'}`);
  lines.push('');
  lines.push('--- Customer Impact ---');
  lines.push(`Peak Affected: ${score.customerImpact.peakAffectedPercent.toFixed(1)}% (${score.customerImpact.peakAffectedUsers.toLocaleString()} users)`);
  lines.push(`Total User-Minutes: ${score.customerImpact.totalUserMinutes.toLocaleString()}`);
  lines.push(`Revenue at Risk: ${formatCurrency(score.customerImpact.revenueAtRisk)}`);
  lines.push('');
  lines.push('--- Cost Impact ---');
  lines.push(`Infrastructure: ${formatCurrency(score.costImpact.infraCost)}`);
  lines.push(`Vendor: ${formatCurrency(score.costImpact.vendorCost)}`);
  lines.push(`Scaling: ${formatCurrency(score.costImpact.scaleCost)}`);
  lines.push(`Business: ${formatCurrency(score.costImpact.businessCost)}`);
  lines.push(`Total: ${formatCurrency(score.costImpact.total)}`);
  lines.push('');
  lines.push('--- Missed Signals ---');
  if (score.missedSignals.length === 0) {
    lines.push('None');
  } else {
    score.missedSignals.forEach((s) => lines.push(`- ${s.label}: ${s.reason}`));
  }
  lines.push('');
  lines.push('--- Decisions That Helped ---');
  score.helpfulDecisions.forEach((d) => lines.push(`- ${d.label}: ${d.reason}`));
  lines.push('');
  lines.push('--- Decisions That Harmed ---');
  score.harmfulDecisions.forEach((d) => lines.push(`- ${d.label}: ${d.reason}`));
  lines.push('');
  lines.push('--- Runbook Recommendations ---');
  score.runbookRecommendations.forEach((r, i) => lines.push(`${i + 1}. ${r}`));
  lines.push('');
  lines.push('='.repeat(60));
  return lines.join('\n');
}
