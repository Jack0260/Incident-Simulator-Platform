import { useEffect, useState } from 'react';
import { Play, Trophy, TrendingUp, BookOpen, AlertTriangle, CheckCircle2, Clock, Zap } from 'lucide-react';
import type { Page } from '@/App';
import type { TrainingProgress } from '@/types';
import type { UserIdentity } from '@/lib/storage';
import { loadLeaderboard, loadTrainingProgress } from '@/lib/storage';
import { SCENARIOS, SCENARIO_TYPE_LABELS } from '@/data/scenarios';
import type { ScenarioType } from '@/types';

interface DashboardPageProps {
  navigate: (page: Page) => void;
  identity: UserIdentity | null;
}

const SCENARIO_TYPES: ScenarioType[] = [
  'database_saturation', 'dependency_outage', 'region_latency_spike', 'bad_deployment',
  'queue_backlog', 'credential_expiration', 'disk_exhaustion', 'traffic_spike',
];

export function DashboardPage({ navigate, identity }: DashboardPageProps) {
  const [leaderboard, setLeaderboard] = useState(() => loadLeaderboard());
  const [progress, setProgress] = useState(() => loadTrainingProgress());

  useEffect(() => {
    setLeaderboard(loadLeaderboard());
    setProgress(loadTrainingProgress());
  }, []);

  const totalRuns = leaderboard.length;
  const avgScore = totalRuns > 0 ? Math.round(leaderboard.reduce((s, e) => s + e.score, 0) / totalRuns) : 0;
  const bestScore = totalRuns > 0 ? Math.max(...leaderboard.map((e) => e.score)) : 0;
  const completedScenarios = progress.filter((p) => p.completed).length;
  const totalScenarioTypes = SCENARIO_TYPES.length;

  const recentRuns = [...leaderboard].sort((a, b) => b.completedAt - a.completedAt).slice(0, 5);
  const topScores = [...leaderboard].sort((a, b) => b.score - a.score).slice(0, 5);

  return (
    <div className="mx-auto max-w-7xl p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">
          Welcome back{identity ? `, ${identity.responderName}` : ''}
        </h1>
        <p className="mt-1 text-sm text-secondary-600 dark:text-secondary-400">
          Train your incident response skills with realistic reliability scenarios
        </p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Zap} label="Total Runs" value={totalRuns} color="primary" />
        <StatCard icon={TrendingUp} label="Average Score" value={avgScore} color="accent" />
        <StatCard icon={Trophy} label="Best Score" value={bestScore} color="success" />
        <StatCard icon={CheckCircle2} label="Scenarios Completed" value={`${completedScenarios}/${totalScenarioTypes}`} color="warning" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Quick Start */}
        <div className="card p-6">
          <h2 className="mb-4 text-lg font-semibold text-secondary-900 dark:text-white">Quick Start</h2>
          <p className="mb-4 text-sm text-secondary-600 dark:text-secondary-400">
            Jump into a scenario and practice your incident response skills.
          </p>
          <button onClick={() => navigate({ name: 'simulate' })} className="btn-primary w-full">
            <Play className="h-4 w-4" />
            Start a Simulation
          </button>
          <div className="mt-4 space-y-2">
            <button onClick={() => navigate({ name: 'runbooks' })} className="btn-secondary w-full">
              <BookOpen className="h-4 w-4" />
              Browse Runbooks
            </button>
            <button onClick={() => navigate({ name: 'analytics' })} className="btn-secondary w-full">
              <TrendingUp className="h-4 w-4" />
              View Analytics
            </button>
          </div>
        </div>

        {/* Training Progress */}
        <div className="card p-6">
          <h2 className="mb-4 text-lg font-semibold text-secondary-900 dark:text-white">Training Progress</h2>
          <div className="space-y-3">
            {SCENARIO_TYPES.map((type) => {
              const p = progress.find((pr) => pr.scenarioType === type);
              const label = SCENARIO_TYPE_LABELS[type];
              return (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {p?.completed ? (
                      <CheckCircle2 className="h-4 w-4 text-success-500" />
                    ) : (
                      <Clock className="h-4 w-4 text-secondary-400" />
                    )}
                    <span className="text-sm text-secondary-700 dark:text-secondary-300">{label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {p ? (
                      <>
                        <span className="text-xs text-secondary-500">{p.attempts} attempt{p.attempts !== 1 ? 's' : ''}</span>
                        <span className={`badge ${p.bestScore >= 70 ? 'badge-success' : p.bestScore >= 50 ? 'badge-warning' : 'badge-critical'}`}>
                          {p.bestScore}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-secondary-400">Not started</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Runs */}
        <div className="card p-6">
          <h2 className="mb-4 text-lg font-semibold text-secondary-900 dark:text-white">Recent Runs</h2>
          {recentRuns.length === 0 ? (
            <p className="text-sm text-secondary-500 dark:text-secondary-400">No runs yet. Start your first simulation!</p>
          ) : (
            <div className="space-y-3">
              {recentRuns.map((run) => (
                <div key={run.id} className="flex items-center justify-between border-b border-secondary-100 pb-3 last:border-0 last:pb-0 dark:border-secondary-800">
                  <div>
                    <p className="text-sm font-medium text-secondary-900 dark:text-white">{run.scenarioName}</p>
                    <p className="text-xs text-secondary-500">{run.responderName} · {new Date(run.completedAt).toLocaleDateString()}</p>
                  </div>
                  <span className={`badge ${run.score >= 80 ? 'badge-success' : run.score >= 60 ? 'badge-warning' : 'badge-critical'}`}>
                    {run.score} · {run.grade}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Scores */}
        <div className="card p-6">
          <h2 className="mb-4 text-lg font-semibold text-secondary-900 dark:text-white">Top Scores</h2>
          {topScores.length === 0 ? (
            <p className="text-sm text-secondary-500 dark:text-secondary-400">No scores yet. Be the first!</p>
          ) : (
            <div className="space-y-3">
              {topScores.map((run, i) => (
                <div key={run.id} className="flex items-center gap-3 border-b border-secondary-100 pb-3 last:border-0 last:pb-0 dark:border-secondary-800">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    i === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                    : i === 1 ? 'bg-secondary-100 text-secondary-600 dark:bg-secondary-800 dark:text-secondary-300'
                    : i === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                    : 'bg-secondary-50 text-secondary-400 dark:bg-secondary-800/50 dark:text-secondary-500'
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-secondary-900 dark:text-white">{run.responderName}</p>
                    <p className="text-xs text-secondary-500">{run.scenarioName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-secondary-900 dark:text-white">{run.score}</p>
                    <p className="text-xs text-secondary-500">{run.grade}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Scenario Types Preview */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-secondary-900 dark:text-white">Available Scenarios</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SCENARIOS.map((scenario) => (
            <button
              key={scenario.id}
              onClick={() => navigate({ name: 'runner', scenarioId: scenario.id })}
              className="card card-hover p-4 text-left"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className={`badge ${
                  scenario.difficulty === 'beginner' ? 'badge-success'
                  : scenario.difficulty === 'intermediate' ? 'badge-warning'
                  : 'badge-critical'
                }`}>
                  {scenario.difficulty}
                </span>
                <AlertTriangle className="h-4 w-4 text-secondary-400" />
              </div>
              <h3 className="text-sm font-semibold text-secondary-900 dark:text-white">{scenario.name}</h3>
              <p className="mt-1 text-xs text-secondary-500 dark:text-secondary-400 line-clamp-2">{scenario.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Play; label: string; value: string | number; color: string }) {
  const colorMap: Record<string, string> = {
    primary: 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400',
    accent: 'bg-accent-50 text-accent-600 dark:bg-accent-900/30 dark:text-accent-400',
    success: 'bg-success-50 text-success-600 dark:bg-success-900/30 dark:text-success-400',
    warning: 'bg-warning-50 text-warning-600 dark:bg-warning-900/30 dark:text-warning-400',
  };
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="stat-label">{label}</p>
          <p className="stat-value mt-1 text-secondary-900 dark:text-white">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colorMap[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
