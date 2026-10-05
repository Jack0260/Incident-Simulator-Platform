import { useState, useMemo } from 'react';
import { Trophy, Trash2, Filter, ArrowUpDown } from 'lucide-react';
import { loadLeaderboard, clearLeaderboard } from '@/lib/storage';
import { SCENARIO_TYPE_LABELS } from '@/data/scenarios';
import type { ScenarioType } from '@/types';

type SortKey = 'score' | 'mttr' | 'mtta' | 'completedAt';

export function LeaderboardPage() {
  const [entries, setEntries] = useState(() => loadLeaderboard());
  const [filterType, setFilterType] = useState<ScenarioType | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortKey>('score');

  const filtered = useMemo(() => {
    let list = entries;
    if (filterType !== 'all') list = list.filter((e) => e.scenarioType === filterType);
    return [...list].sort((a, b) => {
      if (sortBy === 'score') return b.score - a.score;
      if (sortBy === 'completedAt') return b.completedAt - a.completedAt;
      const aVal = a[sortBy] ?? 999999;
      const bVal = b[sortBy] ?? 999999;
      return aVal - bVal;
    });
  }, [entries, filterType, sortBy]);

  const handleClear = () => {
    clearLeaderboard();
    setEntries([]);
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Team Leaderboard</h1>
          <p className="mt-1 text-sm text-secondary-600 dark:text-secondary-400">Top incident response performances</p>
        </div>
        {entries.length > 0 && (
          <button onClick={handleClear} className="btn-ghost text-error-600">
            <Trash2 className="h-4 w-4" /> Clear
          </button>
        )}
      </div>

      <div className="mb-6 flex items-center gap-3">
        <Filter className="h-4 w-4 text-secondary-400" />
        <select className="input w-auto" value={filterType} onChange={(e) => setFilterType(e.target.value as ScenarioType | 'all')}>
          <option value="all">All Scenarios</option>
          {Object.entries(SCENARIO_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <ArrowUpDown className="h-4 w-4 text-secondary-400" />
        <select className="input w-auto" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}>
          <option value="score">Sort by Score</option>
          <option value="mttr">Sort by MTTR</option>
          <option value="mtta">Sort by MTTA</option>
          <option value="completedAt">Sort by Date</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Trophy className="mx-auto mb-4 h-12 w-12 text-secondary-300 dark:text-secondary-700" />
          <p className="text-secondary-500 dark:text-secondary-400">No leaderboard entries yet. Complete a simulation to appear here!</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-secondary-200 bg-secondary-50 dark:border-secondary-800 dark:bg-secondary-800/50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-secondary-700 dark:text-secondary-300">Rank</th>
                <th className="px-4 py-3 text-left font-semibold text-secondary-700 dark:text-secondary-300">Responder</th>
                <th className="px-4 py-3 text-left font-semibold text-secondary-700 dark:text-secondary-300">Scenario</th>
                <th className="px-4 py-3 text-center font-semibold text-secondary-700 dark:text-secondary-300">Score</th>
                <th className="px-4 py-3 text-center font-semibold text-secondary-700 dark:text-secondary-300">Grade</th>
                <th className="px-4 py-3 text-center font-semibold text-secondary-700 dark:text-secondary-300">MTTA</th>
                <th className="px-4 py-3 text-center font-semibold text-secondary-700 dark:text-secondary-300">MTTR</th>
                <th className="px-4 py-3 text-center font-semibold text-secondary-700 dark:text-secondary-300">Root Cause</th>
                <th className="px-4 py-3 text-right font-semibold text-secondary-700 dark:text-secondary-300">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100 dark:divide-secondary-800">
              {filtered.map((entry, i) => (
                <tr key={entry.id} className="transition-colors hover:bg-secondary-50 dark:hover:bg-secondary-800/30">
                  <td className="px-4 py-3">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                      i === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                      : i === 1 ? 'bg-secondary-100 text-secondary-600 dark:bg-secondary-800 dark:text-secondary-300'
                      : i === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                      : 'text-secondary-400'
                    }`}>{i + 1}</div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-secondary-900 dark:text-white">{entry.responderName}</p>
                    <p className="text-xs text-secondary-500">{entry.team}</p>
                  </td>
                  <td className="px-4 py-3 text-secondary-700 dark:text-secondary-300">{entry.scenarioName}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-bold ${entry.score >= 80 ? 'text-success-600 dark:text-success-400' : entry.score >= 60 ? 'text-warning-600 dark:text-warning-400' : 'text-error-600 dark:text-error-400'}`}>
                      {entry.score}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`badge ${entry.score >= 80 ? 'badge-success' : entry.score >= 60 ? 'badge-warning' : 'badge-critical'}`}>{entry.grade}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-secondary-600 dark:text-secondary-400">{entry.mtta !== null ? `${Math.round(entry.mtta / 60)}m ${Math.round(entry.mtta % 60)}s` : 'N/A'}</td>
                  <td className="px-4 py-3 text-center text-secondary-600 dark:text-secondary-400">{entry.mttr !== null ? `${Math.round(entry.mttr / 60)}m ${Math.round(entry.mttr % 60)}s` : 'N/A'}</td>
                  <td className="px-4 py-3 text-center">{entry.rootCauseFound ? '✓' : '✗'}</td>
                  <td className="px-4 py-3 text-right text-xs text-secondary-500">{new Date(entry.completedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
