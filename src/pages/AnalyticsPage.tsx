import { useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp, Clock, AlertTriangle, DollarSign, Award } from 'lucide-react';
import { loadLeaderboard } from '@/lib/storage';
import { SCENARIO_TYPE_LABELS } from '@/data/scenarios';
import type { ScenarioType } from '@/types';

const PIE_COLORS = ['#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export function AnalyticsPage() {
  const entries = useState(() => loadLeaderboard())[0];

  const stats = useMemo(() => {
    if (entries.length === 0) return null;
    const avgScore = Math.round(entries.reduce((s, e) => s + e.score, 0) / entries.length);
    const avgMttr = entries.filter((e) => e.mttr !== null).reduce((s, e) => s + (e.mttr || 0), 0) / (entries.filter((e) => e.mttr !== null).length || 1);
    const totalCost = entries.reduce((s, e) => s + e.totalCost, 0);
    const avgBurn = entries.reduce((s, e) => s + e.errorBudgetBurned, 0) / entries.length;
    const rootCauseRate = Math.round((entries.filter((e) => e.rootCauseFound).length / entries.length) * 100);

    const byType: Record<string, { count: number; avgScore: number; avgMttr: number }> = {};
    for (const e of entries) {
      if (!byType[e.scenarioType]) byType[e.scenarioType] = { count: 0, avgScore: 0, avgMttr: 0 };
      byType[e.scenarioType].count += 1;
      byType[e.scenarioType].avgScore += e.score;
      byType[e.scenarioType].avgMttr += e.mttr || 0;
    }
    const typeData = Object.entries(byType).map(([type, d]) => ({
      type: SCENARIO_TYPE_LABELS[type] || type,
      avgScore: Math.round(d.avgScore / d.count),
      avgMttr: Math.round(d.avgMttr / d.count / 60),
      count: d.count,
    }));

    const scoreDistribution = [
      { range: 'A (90+)', count: entries.filter((e) => e.score >= 90).length },
      { range: 'B (80-89)', count: entries.filter((e) => e.score >= 80 && e.score < 90).length },
      { range: 'C (70-79)', count: entries.filter((e) => e.score >= 70 && e.score < 80).length },
      { range: 'D (60-69)', count: entries.filter((e) => e.score >= 60 && e.score < 70).length },
      { range: 'F (<60)', count: entries.filter((e) => e.score < 60).length },
    ];

    const trend = [...entries].sort((a, b) => a.completedAt - b.completedAt).map((e, i) => ({
      run: i + 1,
      score: e.score,
      responder: e.responderName,
    }));

    const costByType = Object.entries(byType).map(([type, d]) => ({
      type: SCENARIO_TYPE_LABELS[type] || type,
      cost: Math.round(entries.filter((e) => e.scenarioType === type).reduce((s, e) => s + e.totalCost, 0)),
    }));

    return { avgScore, avgMttr, totalCost, avgBurn, rootCauseRate, typeData, scoreDistribution, trend, costByType };
  }, [entries]);

  if (entries.length === 0 || !stats) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <h1 className="mb-6 text-2xl font-bold text-secondary-900 dark:text-white">Historical Analytics</h1>
        <div className="card p-12 text-center">
          <TrendingUp className="mx-auto mb-4 h-12 w-12 text-secondary-300 dark:text-secondary-700" />
          <p className="text-secondary-500 dark:text-secondary-400">No data yet. Complete simulations to see analytics here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Historical Analytics</h1>
        <p className="mt-1 text-sm text-secondary-600 dark:text-secondary-400">Aggregate insights from all simulation runs</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard icon={Award} label="Avg Score" value={stats.avgScore} color="primary" />
        <StatCard icon={Clock} label="Avg MTTR" value={`${Math.round(stats.avgMttr / 60)}m`} color="accent" />
        <StatCard icon={DollarSign} label="Total Cost" value={`$${(stats.totalCost / 1000).toFixed(1)}k`} color="error" />
        <StatCard icon={AlertTriangle} label="Avg Budget Burn" value={`${stats.avgBurn.toFixed(0)}%`} color="warning" />
        <StatCard icon={TrendingUp} label="Root Cause Rate" value={`${stats.rootCauseRate}%`} color="success" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Score Trend */}
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-secondary-900 dark:text-white">Score Trend Over Time</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={stats.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-secondary-200 dark:text-secondary-800" />
              <XAxis dataKey="run" tick={{ fontSize: 11 }} stroke="currentColor" className="text-secondary-400" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="currentColor" className="text-secondary-400" />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="score" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} name="Score" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Score Distribution */}
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-secondary-900 dark:text-white">Score Distribution</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats.scoreDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-secondary-200 dark:text-secondary-800" />
              <XAxis dataKey="range" tick={{ fontSize: 11 }} stroke="currentColor" className="text-secondary-400" />
              <YAxis tick={{ fontSize: 11 }} stroke="currentColor" className="text-secondary-400" allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Runs" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Average Score by Scenario */}
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-secondary-900 dark:text-white">Average Score by Scenario</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats.typeData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-secondary-200 dark:text-secondary-800" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} stroke="currentColor" className="text-secondary-400" />
              <YAxis type="category" dataKey="type" tick={{ fontSize: 10 }} stroke="currentColor" className="text-secondary-400" width={120} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="avgScore" fill="#22c55e" radius={[0, 4, 4, 0]} name="Avg Score" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cost by Scenario */}
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-secondary-900 dark:text-white">Cost Impact by Scenario</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats.costByType} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-secondary-200 dark:text-secondary-800" />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="currentColor" className="text-secondary-400" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="type" tick={{ fontSize: 10 }} stroke="currentColor" className="text-secondary-400" width={120} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} formatter={(v) => `${Number(v).toLocaleString()}`} />
              <Bar dataKey="cost" fill="#ef4444" radius={[0, 4, 4, 0]} name="Cost" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Run Count Pie */}
      <div className="card mt-6 p-5">
        <h2 className="mb-4 text-sm font-semibold text-secondary-900 dark:text-white">Runs by Scenario Type</h2>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={stats.typeData} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={80} label>
              {stats.typeData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Award; label: string; value: string | number; color: string }) {
  const colorMap: Record<string, string> = {
    primary: 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400',
    accent: 'bg-accent-50 text-accent-600 dark:bg-accent-900/30 dark:text-accent-400',
    success: 'bg-success-50 text-success-600 dark:bg-success-900/30 dark:text-success-400',
    warning: 'bg-warning-50 text-warning-600 dark:bg-warning-900/30 dark:text-warning-400',
    error: 'bg-error-50 text-error-600 dark:bg-error-900/30 dark:text-error-400',
  };
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${colorMap[color]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="stat-label">{label}</p>
          <p className="stat-value text-secondary-900 dark:text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}
