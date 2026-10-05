import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Play, Pause, RotateCcw, AlertTriangle, Activity, DollarSign, Users, Gauge,
  Search, Undo2, Server, ToggleLeft, GitBranch, Layers, PhoneCall, Lock, Megaphone,
  CheckCircle2, XCircle, Clock, ChevronRight, TrendingDown, Zap,
} from 'lucide-react';
import type { Page } from '@/App';
import type { SimulationState, ActionId } from '@/types';
import type { UserIdentity } from '@/lib/storage';
import { getScenarioById, SCENARIOS } from '@/data/scenarios';
import { loadCustomScenarios } from '@/lib/storage';
import {
  createInitialState, advanceTick, applyAction, acknowledgeAlert,
  pauseSimulation, resumeSimulation, formatSimTime, getSeverityColor,
  TICK_DURATION_SECONDS,
} from '@/lib/simulation';
import { calculateScore } from '@/lib/scoring';
import { addLeaderboardEntry, updateTrainingProgress } from '@/lib/storage';

const ICON_MAP: Record<string, typeof Search> = {
  Undo2, Server, ToggleLeft, GitBranch, Layers, Gauge, PhoneCall, Lock, Megaphone, Search,
};

interface SimulationRunnerProps {
  scenarioId: string;
  navigate: (page: Page) => void;
  identity: UserIdentity | null;
}

export function SimulationRunner({ scenarioId, navigate, identity }: SimulationRunnerProps) {
  const allScenarios = useMemo(() => [...SCENARIOS, ...loadCustomScenarios()], []);
  const scenario = allScenarios.find((s) => s.id === scenarioId) || getScenarioById(scenarioId);

  const [state, setState] = useState<SimulationState>(() =>
    scenario ? createInitialState(scenario) : createInitialState(SCENARIOS[0]),
  );
  const [speed, setSpeed] = useState(1);
  const [showActionConfirm, setShowActionConfirm] = useState<ActionId | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const tick = useCallback(() => {
    setState((prev) => {
      if (!scenario || prev.isResolved || prev.isFailed || prev.isPaused) return prev;
      return advanceTick(prev, scenario);
    });
  }, [scenario]);

  useEffect(() => {
    if (state.isRunning && !state.isPaused) {
      intervalRef.current = setInterval(tick, 2000 / speed);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [tick, speed, state.isRunning, state.isPaused]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [state.logs]);

  // Handle simulation end
  useEffect(() => {
    if (!scenario || (!state.isResolved && !state.isFailed)) return;
    const score = calculateScore(state, scenario);
    const runId = `run-${Date.now()}`;
    addLeaderboardEntry({
      id: runId,
      responderName: identity?.responderName || 'Anonymous',
      team: identity?.team || 'Unknown',
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      scenarioType: scenario.type,
      score: score.overall,
      grade: score.grade,
      mtta: score.mtta,
      mttr: score.mttr,
      errorBudgetBurned: score.sloImpact.errorBudgetBurned,
      customerImpactPercent: score.customerImpact.peakAffectedPercent,
      totalCost: score.costImpact.total,
      rootCauseFound: score.rootCauseFound,
      completedAt: Date.now(),
    });
    updateTrainingProgress(scenario.type, score.overall);
    navigate({ name: 'postmortem', runId, scenarioId: scenario.id, score: score.overall });
  }, [state.isResolved, state.isFailed]);

  if (!scenario) {
    return (
      <div className="p-6">
        <p className="text-secondary-600 dark:text-secondary-400">Scenario not found.</p>
        <button onClick={() => navigate({ name: 'simulate' })} className="btn-primary mt-4">Back to Simulations</button>
      </div>
    );
  }

  const handleAction = (actionId: ActionId) => {
    setState((prev) => applyAction(prev, scenario, actionId));
    setShowActionConfirm(null);
  };

  const handleReset = () => {
    setState(createInitialState(scenario));
  };

  const chartData = state.metricHistory.map((m) => ({
    time: m.simTime,
    errorRate: Math.round(m.errorRate * 10) / 10,
    latency: Math.round(m.latencyP95),
    availability: Math.round(m.availability * 100) / 100,
    cpu: Math.round(m.cpuUsage),
    mem: Math.round(m.memoryUsage),
  }));

  const m = state.currentMetrics;
  const isEnded = state.isResolved || state.isFailed;
  const actionsTaken = state.actionsTaken;
  const isActionTaken = (id: ActionId) =>
    actionsTaken.some((a) => a.actionId === id && id !== 'status_page' && id !== 'run_diagnostic');

  return (
    <div className="flex h-full flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-secondary-200 bg-white px-6 py-3 dark:border-secondary-800 dark:bg-secondary-900">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate({ name: 'simulate' })} className="btn-ghost px-2">
            <ChevronRight className="h-4 w-4 rotate-180" />
          </button>
          <div>
            <h1 className="text-sm font-semibold text-secondary-900 dark:text-white">{scenario.name}</h1>
            <p className="text-xs text-secondary-500">{scenario.description.slice(0, 80)}...</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-secondary-100 px-3 py-1.5 dark:bg-secondary-800">
            <Clock className="h-4 w-4 text-primary-500" />
            <span className="font-mono text-sm font-semibold text-secondary-900 dark:text-white">
              {formatSimTime(state.simTime)}
            </span>
          </div>
          {!isEnded && (
            <>
              <button
                onClick={() => setState((prev) => prev.isPaused ? resumeSimulation(prev) : pauseSimulation(prev))}
                className="btn-secondary"
              >
                {state.isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                {state.isPaused ? 'Resume' : 'Pause'}
              </button>
              <select className="input w-auto" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={4}>4x</option>
              </select>
            </>
          )}
          <button onClick={handleReset} className="btn-secondary">
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
        </div>
      </div>

      {/* Status Banner */}
      {state.isResolved && (
        <div className="flex items-center gap-2 bg-success-50 px-6 py-2 text-success-700 dark:bg-success-900/20 dark:text-success-400">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-sm font-medium">Incident resolved! Generating postmortem report...</span>
        </div>
      )}
      {state.isFailed && (
        <div className="flex items-center gap-2 bg-error-50 px-6 py-2 text-error-700 dark:bg-error-900/20 dark:text-error-400">
          <XCircle className="h-4 w-4" />
          <span className="text-sm font-medium">Incident escalated to catastrophic failure. Generating postmortem report...</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Left: Metrics + Charts */}
          <div className="space-y-4 lg:col-span-2">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricMini icon={Activity} label="Error Rate" value={`${m.errorRate.toFixed(1)}%`} color={m.errorRate > 5 ? 'error' : 'success'} />
              <MetricMini icon={Gauge} label="P95 Latency" value={`${Math.round(m.latencyP95)}ms`} color={m.latencyP95 > 1000 ? 'error' : m.latencyP95 > 500 ? 'warning' : 'success'} />
              <MetricMini icon={Zap} label="Throughput" value={`${(m.throughput / 1000).toFixed(1)}k/s`} color="primary" />
              <MetricMini icon={TrendingDown} label="Availability" value={`${m.availability.toFixed(2)}%`} color={m.availability < 99 ? 'error' : m.availability < 99.9 ? 'warning' : 'success'} />
              <MetricMini icon={Server} label="CPU" value={`${Math.round(m.cpuUsage)}%`} color={m.cpuUsage > 85 ? 'error' : m.cpuUsage > 70 ? 'warning' : 'success'} />
              <MetricMini icon={Layers} label="Memory" value={`${Math.round(m.memoryUsage)}%`} color={m.memoryUsage > 85 ? 'error' : m.memoryUsage > 70 ? 'warning' : 'success'} />
              <MetricMini icon={AlertTriangle} label="Disk" value={`${Math.round(m.diskUsage)}%`} color={m.diskUsage > 90 ? 'error' : m.diskUsage > 80 ? 'warning' : 'success'} />
              <MetricMini icon={GitBranch} label="Conn Pool" value={`${Math.round(m.connectionPool)}%`} color={m.connectionPool > 90 ? 'error' : m.connectionPool > 75 ? 'warning' : 'success'} />
            </div>

            {/* Error Rate Chart */}
            <div className="card p-4">
              <h3 className="mb-3 text-sm font-semibold text-secondary-900 dark:text-white">Error Rate & Latency</h3>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-secondary-200 dark:text-secondary-800" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="currentColor" className="text-secondary-400" tickFormatter={(v: number) => formatSimTime(Number(v))} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} stroke="currentColor" className="text-secondary-400" />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="currentColor" className="text-secondary-400" />
                  <Tooltip
                    contentStyle={{ background: 'var(--tw-color-secondary-900, #0f172a)', border: '1px solid var(--tw-color-secondary-700, #334155)', borderRadius: 8, fontSize: 12 }}
                    labelFormatter={(v) => formatSimTime(Number(v))}
                  />
                  <Line yAxisId="left" type="monotone" dataKey="errorRate" stroke="#ef4444" strokeWidth={2} dot={false} name="Error Rate %" />
                  <Line yAxisId="right" type="monotone" dataKey="latency" stroke="#f59e0b" strokeWidth={2} dot={false} name="P95 Latency ms" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* System Health Chart */}
            <div className="card p-4">
              <h3 className="mb-3 text-sm font-semibold text-secondary-900 dark:text-white">System Health</h3>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-secondary-200 dark:text-secondary-800" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="currentColor" className="text-secondary-400" tickFormatter={(v: number) => formatSimTime(Number(v))} />
                  <YAxis tick={{ fontSize: 10 }} stroke="currentColor" className="text-secondary-400" />
                  <Tooltip
                    contentStyle={{ background: 'var(--tw-color-secondary-900, #0f172a)', border: '1px solid var(--tw-color-secondary-700, #334155)', borderRadius: 8, fontSize: 12 }}
                    labelFormatter={(v) => formatSimTime(Number(v))}
                  />
                  <Area type="monotone" dataKey="cpu" stackId="1" stroke="#06b6d4" fill="#06b6d420" name="CPU %" />
                  <Area type="monotone" dataKey="mem" stackId="1" stroke="#8b5cf6" fill="#8b5cf620" name="Memory %" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Log Feed */}
            <div className="card p-4">
              <h3 className="mb-3 text-sm font-semibold text-secondary-900 dark:text-white">Live Logs</h3>
              <div ref={logRef} className="h-48 overflow-y-auto rounded-lg bg-secondary-950 p-3 font-mono text-xs">
                {state.logs.length === 0 ? (
                  <p className="text-secondary-500">Waiting for logs...</p>
                ) : (
                  state.logs.slice(-50).map((log) => (
                    <div key={log.id} className="mb-1 flex gap-2">
                      <span className="text-secondary-600">{formatSimTime(log.simTime)}</span>
                      <span className={
                        log.level === 'ERROR' ? 'text-red-400'
                        : log.level === 'WARN' ? 'text-amber-400'
                        : log.level === 'FATAL' ? 'text-red-500 font-bold'
                        : log.level === 'DEBUG' ? 'text-secondary-500'
                        : 'text-green-400'
                      }>[{log.level}]</span>
                      <span className="text-cyan-400">{log.source}</span>
                      <span className="text-secondary-300">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right: Actions + Alerts + Impact */}
          <div className="space-y-4">
            {/* Risk & Impact */}
            <div className="card p-4">
              <h3 className="mb-3 text-sm font-semibold text-secondary-900 dark:text-white">Impact Summary</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-secondary-500">Risk Score</span>
                    <span className="font-semibold text-secondary-900 dark:text-white">{Math.round(state.riskScore)}/100</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary-200 dark:bg-secondary-800">
                    <div
                      className={`h-full transition-all ${state.riskScore > 70 ? 'bg-error-500' : state.riskScore > 40 ? 'bg-warning-500' : 'bg-success-500'}`}
                      style={{ width: `${state.riskScore}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-secondary-500">Error Budget Burned</span>
                    <span className="font-semibold text-secondary-900 dark:text-white">{state.errorBudgetBurned.toFixed(1)}%</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary-200 dark:bg-secondary-800">
                    <div className="h-full bg-amber-500 transition-all" style={{ width: `${Math.min(100, state.errorBudgetBurned)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-secondary-500">Resolution Progress</span>
                    <span className="font-semibold text-secondary-900 dark:text-white">{Math.round(state.resolutionProgress * 100)}%</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary-200 dark:bg-secondary-800">
                    <div className="h-full bg-primary-500 transition-all" style={{ width: `${state.resolutionProgress * 100}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="rounded-lg bg-secondary-100 p-2 dark:bg-secondary-800">
                    <div className="flex items-center gap-1 text-xs text-secondary-500"><Users className="h-3 w-3" /> Affected</div>
                    <p className="text-sm font-semibold text-secondary-900 dark:text-white">{state.customerImpactPercent.toFixed(1)}%</p>
                  </div>
                  <div className="rounded-lg bg-secondary-100 p-2 dark:bg-secondary-800">
                    <div className="flex items-center gap-1 text-xs text-secondary-500"><DollarSign className="h-3 w-3" /> Cost</div>
                    <p className="text-sm font-semibold text-secondary-900 dark:text-white">${Math.round(state.totalCost).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Alerts */}
            <div className="card p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-secondary-900 dark:text-white">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Alert Timeline
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {state.alerts.length === 0 ? (
                  <p className="text-xs text-secondary-500">No alerts yet</p>
                ) : (
                  state.alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`rounded-lg border p-2 text-xs ${getSeverityColor(alert.severity)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{alert.message}</p>
                          <p className="mt-0.5 text-secondary-500">{formatSimTime(alert.simTime)} · {alert.source}</p>
                        </div>
                        {!alert.acknowledged && !isEnded && (
                          <button
                            onClick={() => setState((prev) => acknowledgeAlert(prev, alert.id))}
                            className="ml-2 rounded px-2 py-0.5 text-[10px] font-medium text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/30"
                          >
                            ACK
                          </button>
                        )}
                        {alert.acknowledged && <CheckCircle2 className="h-3 w-3 text-success-500" />}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="card p-4">
              <h3 className="mb-3 text-sm font-semibold text-secondary-900 dark:text-white">Responder Actions</h3>
              <div className="space-y-2">
                {scenario.availableActions.map((action) => {
                  const Icon = ICON_MAP[action.icon] || Search;
                  const taken = isActionTaken(action.id);
                  const available = state.tick >= action.availableFromTick && !isEnded && !taken;
                  const actionRecord = actionsTaken.find((a) => a.actionId === action.id);

                  return (
                    <div key={action.id}>
                      <button
                        onClick={() => available && setShowActionConfirm(action.id)}
                        disabled={!available}
                        className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-all ${
                          available
                            ? 'border-primary-200 bg-primary-50/50 hover:border-primary-400 hover:bg-primary-50 dark:border-primary-800/50 dark:bg-primary-900/10 dark:hover:border-primary-700 dark:hover:bg-primary-900/20'
                            : taken
                              ? 'border-success-200 bg-success-50/50 dark:border-success-800/30 dark:bg-success-900/10'
                              : 'border-secondary-200 bg-secondary-50 opacity-50 dark:border-secondary-800 dark:bg-secondary-800/50'
                        }`}
                      >
                        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${
                          taken ? 'text-success-500' : available ? 'text-primary-500' : 'text-secondary-400'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-secondary-900 dark:text-white">{action.label}</p>
                            {taken && <CheckCircle2 className="h-3 w-3 text-success-500" />}
                          </div>
                          <p className="mt-0.5 text-[10px] text-secondary-500 dark:text-secondary-400">{action.description}</p>
                          <div className="mt-1 flex items-center gap-3 text-[10px] text-secondary-400">
                            <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{action.timeCost}s</span>
                            {action.cost > 0 && <span className="flex items-center gap-1"><DollarSign className="h-2.5 w-2.5" />${action.cost}</span>}
                            {state.tick < action.availableFromTick && <span>Available at {formatSimTime(action.availableFromTick * TICK_DURATION_SECONDS)}</span>}
                          </div>
                        </div>
                      </button>

                      {/* Action Confirmation */}
                      {showActionConfirm === action.id && (
                        <div className="mt-1 rounded-lg border border-primary-300 bg-white p-3 dark:border-primary-700 dark:bg-secondary-800">
                          <p className="text-xs text-secondary-600 dark:text-secondary-300">
                            Execute <strong>{action.label}</strong>? This will take {action.timeCost}s of simulated time.
                          </p>
                          <div className="mt-2 flex gap-2">
                            <button onClick={() => handleAction(action.id)} className="btn-primary px-3 py-1 text-xs">Confirm</button>
                            <button onClick={() => setShowActionConfirm(null)} className="btn-secondary px-3 py-1 text-xs">Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions Taken Log */}
            {actionsTaken.length > 0 && (
              <div className="card p-4">
                <h3 className="mb-3 text-sm font-semibold text-secondary-900 dark:text-white">Decision Log</h3>
                <div className="space-y-2">
                  {actionsTaken.map((action, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-secondary-400">{formatSimTime(action.takenAtSimTime)}</span>
                      <span className="font-medium text-secondary-700 dark:text-secondary-300">{action.label}</span>
                      {action.helped && <CheckCircle2 className="h-3 w-3 text-success-500" />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricMini({ icon: Icon, label, value, color }: { icon: typeof Activity; label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    error: 'text-error-600 dark:text-error-400',
    warning: 'text-warning-600 dark:text-warning-400',
    success: 'text-success-600 dark:text-success-400',
    primary: 'text-primary-600 dark:text-primary-400',
  };
  return (
    <div className="card p-3">
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${colorMap[color]}`} />
        <span className="text-[10px] uppercase tracking-wide text-secondary-500">{label}</span>
      </div>
      <p className={`mt-1 text-lg font-bold tabular-nums ${colorMap[color]}`}>{value}</p>
    </div>
  );
}
