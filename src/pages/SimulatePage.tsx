import { useState, useMemo } from 'react';
import { Search, Play, Filter, AlertTriangle, Clock, Tag } from 'lucide-react';
import type { Page } from '@/App';
import type { ScenarioType } from '@/types';
import type { UserIdentity } from '@/lib/storage';
import { SCENARIOS, SCENARIO_TYPE_LABELS } from '@/data/scenarios';
import { loadCustomScenarios } from '@/lib/storage';

interface SimulatePageProps {
  navigate: (page: Page) => void;
  identity: UserIdentity | null;
  setIdentity: (identity: UserIdentity) => void;
}

const DIFFICULTY_BADGE: Record<string, string> = {
  beginner: 'badge-success',
  intermediate: 'badge-warning',
  advanced: 'badge-critical',
};

export function SimulatePage({ navigate, identity, setIdentity }: SimulatePageProps) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<ScenarioType | 'all'>('all');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all');
  const [name, setName] = useState(identity?.responderName || '');
  const [team, setTeam] = useState(identity?.team || '');

  const allScenarios = useMemo(() => {
    const custom = loadCustomScenarios();
    return [...SCENARIOS, ...custom];
  }, []);

  const filtered = useMemo(() => {
    return allScenarios.filter((s) => {
      if (filterType !== 'all' && s.type !== filterType) return false;
      if (filterDifficulty !== 'all' && s.difficulty !== filterDifficulty) return false;
      if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.description.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [allScenarios, search, filterType, filterDifficulty]);

  const canStart = name.trim().length > 0 && team.trim().length > 0;

  const handleStart = (scenarioId: string) => {
    if (!canStart) return;
    setIdentity({ responderName: name.trim(), team: team.trim() });
    navigate({ name: 'runner', scenarioId });
  };

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Run Simulation</h1>
        <p className="mt-1 text-sm text-secondary-600 dark:text-secondary-400">
          Choose a scenario and practice your incident response decision-making
        </p>
      </div>

      {/* Identity */}
      <div className="card mb-6 p-5">
        <h2 className="mb-3 text-sm font-semibold text-secondary-900 dark:text-white">Responder Identity</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Your Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" />
          </div>
          <div>
            <label className="label">Team</label>
            <input className="input" value={team} onChange={(e) => setTeam(e.target.value)} placeholder="e.g. SRE, Platform, On-Call" />
          </div>
        </div>
        {!canStart && (
          <p className="mt-2 text-xs text-warning-600 dark:text-warning-400">Enter your name and team to start a simulation</p>
        )}
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-400" />
          <input
            className="input pl-10"
            placeholder="Search scenarios..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-secondary-400" />
          <select className="input w-auto" value={filterType} onChange={(e) => setFilterType(e.target.value as ScenarioType | 'all')}>
            <option value="all">All Types</option>
            {Object.entries(SCENARIO_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <select className="input w-auto" value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value)}>
            <option value="all">All Levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
      </div>

      {/* Scenario Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((scenario) => (
          <div key={scenario.id} className="card card-hover flex flex-col p-5">
            <div className="mb-3 flex items-start justify-between">
              <span className={`badge ${DIFFICULTY_BADGE[scenario.difficulty]}`}>
                {scenario.difficulty}
              </span>
              {scenario.isCustom && (
                <span className="badge-info">
                  <Tag className="h-3 w-3" /> Custom
                </span>
              )}
            </div>
            <h3 className="text-base font-semibold text-secondary-900 dark:text-white">{scenario.name}</h3>
            <p className="mt-2 flex-1 text-sm text-secondary-600 dark:text-secondary-400">{scenario.description}</p>
            <div className="mt-4 flex items-center gap-3 text-xs text-secondary-500 dark:text-secondary-400">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {Math.round(scenario.duration / 60)} min
              </span>
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {scenario.signals.length} signals
              </span>
              <span>{scenario.availableActions.length} actions</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {scenario.tags.map((tag) => (
                <span key={tag} className="rounded bg-secondary-100 px-2 py-0.5 text-[10px] text-secondary-600 dark:bg-secondary-800 dark:text-secondary-400">
                  {tag}
                </span>
              ))}
            </div>
            <button
              onClick={() => handleStart(scenario.id)}
              disabled={!canStart}
              className="btn-primary mt-4 w-full"
            >
              <Play className="h-4 w-4" />
              Start Simulation
            </button>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="card p-12 text-center">
          <p className="text-secondary-500 dark:text-secondary-400">No scenarios match your filters</p>
        </div>
      )}
    </div>
  );
}
