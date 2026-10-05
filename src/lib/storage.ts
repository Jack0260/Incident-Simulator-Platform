import type {
  LeaderboardEntry,
  Runbook,
  ScenarioDefinition,
  TrainingProgress,
  ThemeMode,
  ScenarioType,
} from '@/types';

const KEYS = {
  scenarios: 'is_scenarios',
  runbooks: 'is_runbooks',
  leaderboard: 'is_leaderboard',
  training: 'is_training',
  theme: 'is_theme',
  identity: 'is_identity',
} as const;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or unavailable — silently ignore
  }
}

// ---- Scenarios ----

export function loadCustomScenarios(): ScenarioDefinition[] {
  return read<ScenarioDefinition[]>(KEYS.scenarios, []);
}

export function saveCustomScenario(scenario: ScenarioDefinition): void {
  const existing = loadCustomScenarios();
  const idx = existing.findIndex((s) => s.id === scenario.id);
  if (idx >= 0) {
    existing[idx] = scenario;
  } else {
    existing.push(scenario);
  }
  write(KEYS.scenarios, existing);
}

export function deleteCustomScenario(id: string): void {
  const existing = loadCustomScenarios();
  write(
    KEYS.scenarios,
    existing.filter((s) => s.id !== id),
  );
}

// ---- Runbooks ----

export function loadCustomRunbooks(): Runbook[] {
  return read<Runbook[]>(KEYS.runbooks, []);
}

export function saveCustomRunbook(runbook: Runbook): void {
  const existing = loadCustomRunbooks();
  const idx = existing.findIndex((r) => r.id === runbook.id);
  if (idx >= 0) {
    existing[idx] = runbook;
  } else {
    existing.push(runbook);
  }
  write(KEYS.runbooks, existing);
}

export function deleteCustomRunbook(id: string): void {
  const existing = loadCustomRunbooks();
  write(
    KEYS.runbooks,
    existing.filter((r) => r.id !== id),
  );
}

// ---- Leaderboard ----

export function loadLeaderboard(): LeaderboardEntry[] {
  return read<LeaderboardEntry[]>(KEYS.leaderboard, []);
}

export function addLeaderboardEntry(entry: LeaderboardEntry): void {
  const existing = loadLeaderboard();
  existing.push(entry);
  existing.sort((a, b) => b.score - a.score);
  write(KEYS.leaderboard, existing);
}

export function clearLeaderboard(): void {
  write(KEYS.leaderboard, []);
}

// ---- Training Progress ----

export function loadTrainingProgress(): TrainingProgress[] {
  return read<TrainingProgress[]>(KEYS.training, []);
}

export function updateTrainingProgress(
  scenarioType: ScenarioType,
  score: number,
): void {
  const existing = loadTrainingProgress();
  const idx = existing.findIndex((t) => t.scenarioType === scenarioType);
  const now = Date.now();
  if (idx >= 0) {
    const t = existing[idx];
    t.attempts += 1;
    t.bestScore = Math.max(t.bestScore, score);
    t.lastScore = score;
    t.averageScore =
      (t.averageScore * (t.attempts - 1) + score) / t.attempts;
    t.completed = score >= 60;
    t.lastAttemptAt = now;
    existing[idx] = t;
  } else {
    existing.push({
      scenarioType,
      attempts: 1,
      bestScore: score,
      averageScore: score,
      lastScore: score,
      completed: score >= 60,
      lastAttemptAt: now,
    });
  }
  write(KEYS.training, existing);
}

// ---- Theme ----

export function loadTheme(): ThemeMode {
  return read<ThemeMode>(KEYS.theme, 'dark');
}

export function saveTheme(mode: ThemeMode): void {
  write(KEYS.theme, mode);
}

// ---- Identity ----

export interface UserIdentity {
  responderName: string;
  team: string;
}

export function loadIdentity(): UserIdentity | null {
  return read<UserIdentity | null>(KEYS.identity, null);
}

export function saveIdentity(identity: UserIdentity): void {
  write(KEYS.identity, identity);
}
