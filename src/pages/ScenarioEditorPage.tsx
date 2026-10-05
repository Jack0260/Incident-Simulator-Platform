import { useState, useMemo } from 'react';
import { Plus, Edit3, Trash2, Copy, Save, X, Search } from 'lucide-react';
import type { ScenarioDefinition, ScenarioType, ActionId, ResponderAction, ActionEffect, SignalDefinition, MetricKey } from '@/types';
import { SCENARIOS, SCENARIO_TYPE_LABELS, ACTION_LABELS } from '@/data/scenarios';
import { loadCustomScenarios, saveCustomScenario, deleteCustomScenario } from '@/lib/storage';

const ALL_ACTION_IDS: ActionId[] = [
  'rollback_release', 'scale_service', 'enable_kill_switch', 'failover_secondary',
  'increase_queue_workers', 'add_rate_limiting', 'escalate_vendor', 'readonly_mode',
  'status_page', 'run_diagnostic',
];

const METRIC_KEYS: MetricKey[] = [
  'errorRate', 'latencyP95', 'latencyP99', 'throughput', 'queueDepth',
  'cpuUsage', 'memoryUsage', 'diskUsage', 'connectionPool', 'activeUsers',
  'errorBudgetBurn', 'availability',
];

const EMPTY_SCENARIO: ScenarioDefinition = {
  id: '',
  name: '',
  type: 'database_saturation',
  description: '',
  difficulty: 'intermediate',
  duration: 1200,
  initialMetrics: {
    errorRate: 2, latencyP95: 300, latencyP99: 500, throughput: 10000,
    queueDepth: 50, cpuUsage: 60, memoryUsage: 60, diskUsage: 50,
    connectionPool: 50, activeUsers: 30000, errorBudgetBurn: 5, availability: 99.5,
  },
  rootCause: '',
  rootCauseHint: '',
  diagnosticActionId: 'run_diagnostic',
  signals: [],
  availableActions: [],
  actionEffects: {} as Record<ActionId, ActionEffect>,
  optimalActionSequence: [],
  metricEvolution: [],
  logGenerators: [],
  alertSchedule: [],
  customerImpactModel: {
    usersTotal: 30000, initialAffectedPercent: 10, maxAffectedPercent: 50,
    revenuePerHour: 20000, impactGrowthRate: 1,
  },
  sloTarget: 99.9,
  costModel: {
    baseInfraCostPerHour: 400, scaleCostPerInstancePerHour: 40,
    vendorEscalationCost: 1000, businessCostPerDowntimeHour: 20000,
  },
  tags: [],
  isCustom: true,
};

export function ScenarioEditorPage() {
  const [customScenarios, setCustomScenarios] = useState(() => loadCustomScenarios());
  const [editing, setEditing] = useState<ScenarioDefinition | null>(null);
  const [search, setSearch] = useState('');
  const [showActionEditor, setShowActionEditor] = useState(false);

  const allScenarios = useMemo(() => [...SCENARIOS, ...customScenarios], [customScenarios]);
  const filtered = allScenarios.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase()),
  );

  const handleNew = () => {
    setEditing({ ...EMPTY_SCENARIO, id: `custom-${Date.now()}` });
  };

  const handleDuplicate = (scenario: ScenarioDefinition) => {
    const copy: ScenarioDefinition = {
      ...JSON.parse(JSON.stringify(scenario)),
      id: `custom-${Date.now()}`,
      name: `${scenario.name} (Copy)`,
      isCustom: true,
    };
    setEditing(copy);
  };

  const handleEdit = (scenario: ScenarioDefinition) => {
    if (!scenario.isCustom) {
      handleDuplicate(scenario);
      return;
    }
    setEditing(JSON.parse(JSON.stringify(scenario)));
  };

  const handleSave = () => {
    if (!editing || !editing.name.trim()) return;
    saveCustomScenario(editing);
    setCustomScenarios(loadCustomScenarios());
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    deleteCustomScenario(id);
    setCustomScenarios(loadCustomScenarios());
  };

  if (editing) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">
            {editing.name ? editing.name : 'New Scenario'}
          </h1>
          <div className="flex gap-2">
            <button onClick={handleSave} className="btn-primary">
              <Save className="h-4 w-4" /> Save
            </button>
            <button onClick={() => setEditing(null)} className="btn-secondary">
              <X className="h-4 w-4" /> Cancel
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-secondary-900 dark:text-white">Basic Information</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Scenario Name</label>
                <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Type</label>
                <select className="input" value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value as ScenarioType })}>
                  {Object.entries(SCENARIO_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Difficulty</label>
                <select className="input" value={editing.difficulty} onChange={(e) => setEditing({ ...editing, difficulty: e.target.value as 'beginner' | 'intermediate' | 'advanced' })}>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
              <div>
                <label className="label">Duration (seconds)</label>
                <input type="number" className="input" value={editing.duration} onChange={(e) => setEditing({ ...editing, duration: Number(e.target.value) })} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Description</label>
                <textarea className="input min-h-[80px]" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Root Cause */}
          <div className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-secondary-900 dark:text-white">Root Cause</h2>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="label">Root Cause</label>
                <textarea className="input min-h-[60px]" value={editing.rootCause} onChange={(e) => setEditing({ ...editing, rootCause: e.target.value })} placeholder="The hidden underlying cause of the incident" />
              </div>
              <div>
                <label className="label">Root Cause Hint</label>
                <input className="input" value={editing.rootCauseHint} onChange={(e) => setEditing({ ...editing, rootCauseHint: e.target.value })} placeholder="Hint for responders" />
              </div>
              <div>
                <label className="label">Diagnostic Action</label>
                <select className="input" value={editing.diagnosticActionId} onChange={(e) => setEditing({ ...editing, diagnosticActionId: e.target.value as ActionId })}>
                  {ALL_ACTION_IDS.map((id) => <option key={id} value={id}>{ACTION_LABELS[id]}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Initial Metrics */}
          <div className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-secondary-900 dark:text-white">Initial Metrics</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {METRIC_KEYS.map((key) => (
                <div key={key}>
                  <label className="label text-xs">{key}</label>
                  <input
                    type="number"
                    className="input"
                    value={(editing.initialMetrics as Record<string, number>)[key]}
                    onChange={(e) => setEditing({
                      ...editing,
                      initialMetrics: { ...editing.initialMetrics, [key]: Number(e.target.value) },
                    })}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Customer Impact Model */}
          <div className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-secondary-900 dark:text-white">Customer Impact Model</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <label className="label text-xs">Total Users</label>
                <input type="number" className="input" value={editing.customerImpactModel.usersTotal} onChange={(e) => setEditing({ ...editing, customerImpactModel: { ...editing.customerImpactModel, usersTotal: Number(e.target.value) } })} />
              </div>
              <div>
                <label className="label text-xs">Initial Affected %</label>
                <input type="number" className="input" value={editing.customerImpactModel.initialAffectedPercent} onChange={(e) => setEditing({ ...editing, customerImpactModel: { ...editing.customerImpactModel, initialAffectedPercent: Number(e.target.value) } })} />
              </div>
              <div>
                <label className="label text-xs">Max Affected %</label>
                <input type="number" className="input" value={editing.customerImpactModel.maxAffectedPercent} onChange={(e) => setEditing({ ...editing, customerImpactModel: { ...editing.customerImpactModel, maxAffectedPercent: Number(e.target.value) } })} />
              </div>
              <div>
                <label className="label text-xs">Revenue/Hour ($)</label>
                <input type="number" className="input" value={editing.customerImpactModel.revenuePerHour} onChange={(e) => setEditing({ ...editing, customerImpactModel: { ...editing.customerImpactModel, revenuePerHour: Number(e.target.value) } })} />
              </div>
              <div>
                <label className="label text-xs">Impact Growth Rate</label>
                <input type="number" step="0.1" className="input" value={editing.customerImpactModel.impactGrowthRate} onChange={(e) => setEditing({ ...editing, customerImpactModel: { ...editing.customerImpactModel, impactGrowthRate: Number(e.target.value) } })} />
              </div>
            </div>
          </div>

          {/* Cost Model */}
          <div className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-secondary-900 dark:text-white">Cost Model</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="label text-xs">Base Infra $/hr</label>
                <input type="number" className="input" value={editing.costModel.baseInfraCostPerHour} onChange={(e) => setEditing({ ...editing, costModel: { ...editing.costModel, baseInfraCostPerHour: Number(e.target.value) } })} />
              </div>
              <div>
                <label className="label text-xs">Scale Cost $/inst/hr</label>
                <input type="number" className="input" value={editing.costModel.scaleCostPerInstancePerHour} onChange={(e) => setEditing({ ...editing, costModel: { ...editing.costModel, scaleCostPerInstancePerHour: Number(e.target.value) } })} />
              </div>
              <div>
                <label className="label text-xs">Vendor Escalation $</label>
                <input type="number" className="input" value={editing.costModel.vendorEscalationCost} onChange={(e) => setEditing({ ...editing, costModel: { ...editing.costModel, vendorEscalationCost: Number(e.target.value) } })} />
              </div>
              <div>
                <label className="label text-xs">Business Cost $/hr</label>
                <input type="number" className="input" value={editing.costModel.businessCostPerDowntimeHour} onChange={(e) => setEditing({ ...editing, costModel: { ...editing.costModel, businessCostPerDowntimeHour: Number(e.target.value) } })} />
              </div>
            </div>
          </div>

          {/* Available Actions */}
          <div className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-secondary-900 dark:text-white">Available Actions</h2>
            <div className="space-y-2">
              {ALL_ACTION_IDS.map((actionId) => {
                const isSelected = editing.availableActions.some((a) => a.id === actionId);
                return (
                  <label key={actionId} className="flex items-center gap-3 rounded-lg border border-secondary-200 p-3 dark:border-secondary-700">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const baseAction = SCENARIOS[0].availableActions.find((a) => a.id === actionId);
                          if (baseAction) {
                            setEditing({ ...editing, availableActions: [...editing.availableActions, { ...baseAction }] });
                          }
                        } else {
                          setEditing({ ...editing, availableActions: editing.availableActions.filter((a) => a.id !== actionId) });
                        }
                      }}
                      className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-secondary-700 dark:text-secondary-300">{ACTION_LABELS[actionId]}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Optimal Sequence */}
          <div className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-secondary-900 dark:text-white">Optimal Action Sequence</h2>
            <p className="mb-3 text-xs text-secondary-500">Click actions in the optimal order for resolving this scenario</p>
            <div className="flex flex-wrap gap-2">
              {editing.optimalActionSequence.map((id, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-primary-50 px-3 py-1.5 text-sm dark:bg-primary-900/30">
                  <span className="text-xs text-secondary-500">{i + 1}.</span>
                  <span className="text-secondary-900 dark:text-white">{ACTION_LABELS[id]}</span>
                  <button onClick={() => setEditing({ ...editing, optimalActionSequence: editing.optimalActionSequence.filter((_, idx) => idx !== i) })} className="text-error-500 hover:text-error-700">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {ALL_ACTION_IDS.filter((id) => !editing.optimalActionSequence.includes(id)).map((id) => (
                <button key={id} onClick={() => setEditing({ ...editing, optimalActionSequence: [...editing.optimalActionSequence, id] })} className="btn-ghost px-2 py-1 text-xs">
                  + {ACTION_LABELS[id]}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-secondary-900 dark:text-white">Tags</h2>
            <div className="flex flex-wrap gap-2">
              {editing.tags.map((tag, i) => (
                <div key={i} className="flex items-center gap-1 rounded-lg bg-secondary-100 px-2 py-1 text-xs dark:bg-secondary-800">
                  {tag}
                  <button onClick={() => setEditing({ ...editing, tags: editing.tags.filter((_, idx) => idx !== i) })}>
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <input
                className="input w-32 text-xs"
                placeholder="Add tag..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = (e.target as HTMLInputElement).value.trim();
                    if (val) {
                      setEditing({ ...editing, tags: [...editing.tags, val] });
                      (e.target as HTMLInputElement).value = '';
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Scenario Editor</h1>
          <p className="mt-1 text-sm text-secondary-600 dark:text-secondary-400">Create and customize incident scenarios</p>
        </div>
        <button onClick={handleNew} className="btn-primary">
          <Plus className="h-4 w-4" /> New Scenario
        </button>
      </div>

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-400" />
        <input className="input pl-10" placeholder="Search scenarios..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((scenario) => (
          <div key={scenario.id} className="card p-5">
            <div className="mb-2 flex items-center justify-between">
              <span className={`badge ${scenario.difficulty === 'beginner' ? 'badge-success' : scenario.difficulty === 'intermediate' ? 'badge-warning' : 'badge-critical'}`}>
                {scenario.difficulty}
              </span>
              {scenario.isCustom && <span className="badge-info">Custom</span>}
            </div>
            <h3 className="text-sm font-semibold text-secondary-900 dark:text-white">{scenario.name}</h3>
            <p className="mt-1 text-xs text-secondary-500 dark:text-secondary-400 line-clamp-2">{scenario.description}</p>
            <div className="mt-3 flex items-center gap-2">
              <button onClick={() => handleEdit(scenario)} className="btn-secondary px-3 py-1 text-xs">
                {scenario.isCustom ? <><Edit3 className="h-3 w-3" /> Edit</> : <><Copy className="h-3 w-3" /> Duplicate</>}
              </button>
              {scenario.isCustom && (
                <button onClick={() => handleDelete(scenario.id)} className="btn-ghost px-3 py-1 text-xs text-error-600 hover:text-error-700">
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
