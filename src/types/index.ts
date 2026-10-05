// ============ Core Domain Types ============

export type ScenarioType =
  | 'database_saturation'
  | 'dependency_outage'
  | 'region_latency_spike'
  | 'bad_deployment'
  | 'queue_backlog'
  | 'credential_expiration'
  | 'disk_exhaustion'
  | 'traffic_spike';

export type Severity = 'info' | 'warning' | 'critical' | 'resolved';

export type MetricKey =
  | 'errorRate'
  | 'latencyP95'
  | 'latencyP99'
  | 'throughput'
  | 'queueDepth'
  | 'cpuUsage'
  | 'memoryUsage'
  | 'diskUsage'
  | 'connectionPool'
  | 'activeUsers'
  | 'errorBudgetBurn'
  | 'availability';

export interface MetricSnapshot {
  tick: number;
  simTime: number; // seconds since incident start
  errorRate: number; // %
  latencyP95: number; // ms
  latencyP99: number; // ms
  throughput: number; // req/s
  queueDepth: number; // messages
  cpuUsage: number; // %
  memoryUsage: number; // %
  diskUsage: number; // %
  connectionPool: number; // % utilized
  activeUsers: number; // count
  errorBudgetBurn: number; // % of budget burned (0-100)
  availability: number; // % (0-100)
}

export interface AlertEvent {
  id: string;
  tick: number;
  simTime: number;
  severity: Severity;
  source: string;
  message: string;
  acknowledged: boolean;
  acknowledgedAt?: number;
}

export interface LogEntry {
  id: string;
  tick: number;
  simTime: number;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  source: string;
  message: string;
}

export type ActionId =
  | 'rollback_release'
  | 'scale_service'
  | 'enable_kill_switch'
  | 'failover_secondary'
  | 'increase_queue_workers'
  | 'add_rate_limiting'
  | 'escalate_vendor'
  | 'readonly_mode'
  | 'status_page'
  | 'run_diagnostic';

export interface ResponderAction {
  id: ActionId;
  label: string;
  description: string;
  icon: string; // lucide icon name
  timeCost: number; // simulated seconds to execute
  baseRiskDelta: number; // risk change
  cost: number; // dollar cost
  availableFromTick: number;
  requiresDiagnosis?: boolean; // only available after root cause diagnosed
}

export interface ActionEffect {
  metricDeltas: Partial<Record<MetricKey, number>>;
  riskDelta: number;
  costDelta: number;
  helpsRecovery: boolean; // does this action move toward resolution?
  resolutionProgressDelta: number; // 0-1, how much this contributes to resolving
  customerImpactReduction: number; // 0-1
}

export interface SignalDefinition {
  id: string;
  label: string;
  description: string;
  severity: Severity;
  revealedAtTick: number;
  metricKey: MetricKey;
  threshold: number;
  source?: string;
}

export interface ScenarioDefinition {
  id: string;
  name: string;
  type: ScenarioType;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: number; // total simulated seconds
  initialMetrics: Omit<MetricSnapshot, 'tick' | 'simTime'>;
  rootCause: string;
  rootCauseHint: string;
  diagnosticActionId: ActionId; // the action that reveals the root cause
  signals: SignalDefinition[];
  availableActions: ResponderAction[];
  actionEffects: Record<ActionId, ActionEffect>;
  optimalActionSequence: ActionId[];
  metricEvolution: MetricEvolutionRule[];
  logGenerators: LogGenerator[];
  alertSchedule: AlertSchedule[];
  customerImpactModel: CustomerImpactModel;
  sloTarget: number; // e.g. 99.9
  costModel: CostModel;
  tags: string[];
  isCustom?: boolean;
}

export interface MetricEvolutionRule {
  metricKey: MetricKey;
  baseRate: number; // rate of change per tick without intervention
  accelerationFactor: number; // how much it accelerates over time
  max: number;
  min: number;
  decayAfterResolution: number; // rate of recovery per tick after resolution starts
}

export interface LogGenerator {
  id: string;
  source: string;
  interval: number; // every N ticks
  level: LogEntry['level'];
  templates: string[];
  condition?: (state: SimulationState) => boolean;
}

export interface AlertSchedule {
  id: string;
  atTick: number;
  severity: Severity;
  source: string;
  message: string;
}

export interface CustomerImpactModel {
  usersTotal: number;
  initialAffectedPercent: number;
  maxAffectedPercent: number;
  revenuePerHour: number; // dollars
  impactGrowthRate: number; // per tick without intervention
}

export interface CostModel {
  baseInfraCostPerHour: number;
  scaleCostPerInstancePerHour: number;
  vendorEscalationCost: number;
  businessCostPerDowntimeHour: number;
}

// ============ Simulation State ============

export interface SimulationState {
  scenarioId: string;
  tick: number;
  simTime: number; // seconds
  isRunning: boolean;
  isPaused: boolean;
  isResolved: boolean;
  isFailed: boolean;
  currentMetrics: MetricSnapshot;
  metricHistory: MetricSnapshot[];
  alerts: AlertEvent[];
  logs: LogEntry[];
  actionsTaken: TakenAction[];
  riskScore: number; // 0-100
  rootCauseDiagnosed: boolean;
  resolutionProgress: number; // 0-1
  customerImpactPercent: number;
  totalCost: number;
  errorBudgetBurned: number; // cumulative %
  firstAlertTime: number | null;
  firstActionTime: number | null;
  resolvedTime: number | null;
  startTime: number; // wall-clock timestamp
}

export interface TakenAction {
  actionId: ActionId;
  label: string;
  takenAtTick: number;
  takenAtSimTime: number;
  effect: ActionEffect;
  helped: boolean;
}

// ============ Scoring ============

export interface IncidentScore {
  overall: number; // 0-100
  grade: string; // A-F
  mtta: number | null; // seconds
  mttr: number | null; // seconds
  sloImpact: SLOImpact;
  customerImpact: CustomerImpactResult;
  costImpact: CostImpactResult;
  missedSignals: MissedSignal[];
  helpfulDecisions: DecisionRecord[];
  harmfulDecisions: DecisionRecord[];
  runbookRecommendations: string[];
  rootCauseFound: boolean;
}

export interface SLOImpact {
  errorBudgetBurned: number;
  budgetRemaining: number;
  burnRate: number;
  sloBreached: boolean;
}

export interface CustomerImpactResult {
  peakAffectedPercent: number;
  peakAffectedUsers: number;
  totalUserMinutes: number;
  revenueAtRisk: number;
}

export interface CostImpactResult {
  infraCost: number;
  vendorCost: number;
  scaleCost: number;
  businessCost: number;
  total: number;
}

export interface MissedSignal {
  signalId: string;
  label: string;
  revealedAtSimTime: number;
  reason: string;
}

export interface DecisionRecord {
  actionId: ActionId;
  label: string;
  takenAtSimTime: number;
  reason: string;
}

// ============ Runbook ============

export interface Runbook {
  id: string;
  title: string;
  scenarioType: ScenarioType;
  description: string;
  steps: RunbookStep[];
  escalationContacts: EscalationContact[];
  isCustom?: boolean;
}

export interface RunbookStep {
  order: number;
  action: string;
  expectedImpact: string;
  timeEstimate: string;
}

export interface EscalationContact {
  role: string;
  contact: string;
}

// ============ Leaderboard & Analytics ============

export interface LeaderboardEntry {
  id: string;
  responderName: string;
  team: string;
  scenarioId: string;
  scenarioName: string;
  scenarioType: ScenarioType;
  score: number;
  grade: string;
  mtta: number | null;
  mttr: number | null;
  errorBudgetBurned: number;
  customerImpactPercent: number;
  totalCost: number;
  rootCauseFound: boolean;
  completedAt: number; // wall-clock timestamp
}

export interface TrainingProgress {
  scenarioType: ScenarioType;
  attempts: number;
  bestScore: number;
  averageScore: number;
  lastScore: number;
  completed: boolean;
  lastAttemptAt: number | null;
}

export type ThemeMode = 'dark' | 'light';
