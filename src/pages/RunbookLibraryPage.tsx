import { useState, useMemo } from 'react';
import { Plus, Edit3, Trash2, Save, X, BookOpen, Phone, Clock, CheckCircle2 } from 'lucide-react';
import type { Runbook, ScenarioType } from '@/types';
import { RUNBOOKS } from '@/data/runbooks';
import { SCENARIO_TYPE_LABELS } from '@/data/scenarios';
import { loadCustomRunbooks, saveCustomRunbook, deleteCustomRunbook } from '@/lib/storage';

const EMPTY_RUNBOOK: Runbook = {
  id: '',
  title: '',
  scenarioType: 'database_saturation',
  description: '',
  steps: [],
  escalationContacts: [],
  isCustom: true,
};

export function RunbookLibraryPage() {
  const [customRunbooks, setCustomRunbooks] = useState(() => loadCustomRunbooks());
  const [editing, setEditing] = useState<Runbook | null>(null);
  const [filterType, setFilterType] = useState<ScenarioType | 'all'>('all');

  const allRunbooks = useMemo(() => [...RUNBOOKS, ...customRunbooks], [customRunbooks]);
  const filtered = allRunbooks.filter((r) => filterType === 'all' || r.scenarioType === filterType);
  const [selected, setSelected] = useState<Runbook | null>(null);

  const handleSave = () => {
    if (!editing || !editing.title.trim()) return;
    saveCustomRunbook(editing);
    setCustomRunbooks(loadCustomRunbooks());
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    deleteCustomRunbook(id);
    setCustomRunbooks(loadCustomRunbooks());
  };

  if (selected) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <button onClick={() => setSelected(null)} className="btn-ghost mb-4">
          <X className="h-4 w-4" /> Back to Library
        </button>
        <div className="card p-6">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-secondary-900 dark:text-white">{selected.title}</h1>
              <p className="mt-1 text-sm text-secondary-500">{SCENARIO_TYPE_LABELS[selected.scenarioType]}</p>
            </div>
            {selected.isCustom && (
              <div className="flex gap-2">
                <button onClick={() => { setEditing(JSON.parse(JSON.stringify(selected))); setSelected(null); }} className="btn-secondary px-3 py-1 text-xs">
                  <Edit3 className="h-3 w-3" /> Edit
                </button>
                <button onClick={() => handleDelete(selected.id)} className="btn-ghost px-3 py-1 text-xs text-error-600">
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            )}
          </div>
          <p className="mb-6 text-sm text-secondary-600 dark:text-secondary-400">{selected.description}</p>

          <h2 className="mb-3 text-sm font-semibold text-secondary-900 dark:text-white">Response Steps</h2>
          <div className="space-y-3">
            {selected.steps.map((step) => (
              <div key={step.order} className="flex gap-4 rounded-lg border border-secondary-200 p-4 dark:border-secondary-700">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700 dark:bg-primary-900 dark:text-primary-300">
                  {step.order}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-secondary-900 dark:text-white">{step.action}</p>
                  <div className="mt-2 flex items-center gap-4 text-xs text-secondary-500">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {step.timeEstimate}</span>
                  </div>
                  <p className="mt-2 text-xs text-secondary-600 dark:text-secondary-400">
                    <CheckCircle2 className="mr-1 inline h-3 w-3 text-success-500" />
                    {step.expectedImpact}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <h2 className="mb-3 mt-6 text-sm font-semibold text-secondary-900 dark:text-white">Escalation Contacts</h2>
          <div className="space-y-2">
            {selected.escalationContacts.map((contact, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-secondary-50 p-3 dark:bg-secondary-800/50">
                <Phone className="h-4 w-4 text-primary-500" />
                <div>
                  <p className="text-sm font-medium text-secondary-900 dark:text-white">{contact.role}</p>
                  <p className="text-xs text-secondary-500">{contact.contact}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">{editing.title || 'New Runbook'}</h1>
          <div className="flex gap-2">
            <button onClick={handleSave} className="btn-primary"><Save className="h-4 w-4" /> Save</button>
            <button onClick={() => setEditing(null)} className="btn-secondary"><X className="h-4 w-4" /> Cancel</button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Title</label>
                <input className="input" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div>
                <label className="label">Scenario Type</label>
                <select className="input" value={editing.scenarioType} onChange={(e) => setEditing({ ...editing, scenarioType: e.target.value as ScenarioType })}>
                  {Object.entries(SCENARIO_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Description</label>
                <textarea className="input min-h-[60px]" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-secondary-900 dark:text-white">Steps</h2>
              <button onClick={() => setEditing({
                ...editing,
                steps: [...editing.steps, { order: editing.steps.length + 1, action: '', expectedImpact: '', timeEstimate: '' }],
              })} className="btn-ghost px-2 py-1 text-xs"><Plus className="h-3 w-3" /> Add Step</button>
            </div>
            <div className="space-y-3">
              {editing.steps.map((step, i) => (
                <div key={i} className="flex gap-2 rounded-lg border border-secondary-200 p-3 dark:border-secondary-700">
                  <span className="text-sm font-bold text-secondary-400">{i + 1}</span>
                  <div className="flex-1 space-y-2">
                    <input className="input text-sm" placeholder="Action" value={step.action} onChange={(e) => {
                      const steps = [...editing.steps];
                      steps[i] = { ...step, action: e.target.value };
                      setEditing({ ...editing, steps });
                    }} />
                    <input className="input text-sm" placeholder="Expected impact" value={step.expectedImpact} onChange={(e) => {
                      const steps = [...editing.steps];
                      steps[i] = { ...step, expectedImpact: e.target.value };
                      setEditing({ ...editing, steps });
                    }} />
                    <input className="input text-sm" placeholder="Time estimate" value={step.timeEstimate} onChange={(e) => {
                      const steps = [...editing.steps];
                      steps[i] = { ...step, timeEstimate: e.target.value };
                      setEditing({ ...editing, steps });
                    }} />
                  </div>
                  <button onClick={() => setEditing({ ...editing, steps: editing.steps.filter((_, idx) => idx !== i) })} className="text-error-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-secondary-900 dark:text-white">Escalation Contacts</h2>
              <button onClick={() => setEditing({
                ...editing,
                escalationContacts: [...editing.escalationContacts, { role: '', contact: '' }],
              })} className="btn-ghost px-2 py-1 text-xs"><Plus className="h-3 w-3" /> Add Contact</button>
            </div>
            <div className="space-y-2">
              {editing.escalationContacts.map((contact, i) => (
                <div key={i} className="flex gap-2">
                  <input className="input text-sm" placeholder="Role" value={contact.role} onChange={(e) => {
                    const contacts = [...editing.escalationContacts];
                    contacts[i] = { ...contact, role: e.target.value };
                    setEditing({ ...editing, escalationContacts: contacts });
                  }} />
                  <input className="input text-sm" placeholder="Contact" value={contact.contact} onChange={(e) => {
                    const contacts = [...editing.escalationContacts];
                    contacts[i] = { ...contact, contact: e.target.value };
                    setEditing({ ...editing, escalationContacts: contacts });
                  }} />
                  <button onClick={() => setEditing({ ...editing, escalationContacts: editing.escalationContacts.filter((_, idx) => idx !== i) })} className="text-error-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
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
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Runbook Library</h1>
          <p className="mt-1 text-sm text-secondary-600 dark:text-secondary-400">Response procedures for each scenario type</p>
        </div>
        <button onClick={() => setEditing({ ...EMPTY_RUNBOOK, id: `custom-rb-${Date.now()}` })} className="btn-primary">
          <Plus className="h-4 w-4" /> New Runbook
        </button>
      </div>

      <div className="mb-6">
        <select className="input w-auto" value={filterType} onChange={(e) => setFilterType(e.target.value as ScenarioType | 'all')}>
          <option value="all">All Types</option>
          {Object.entries(SCENARIO_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((runbook) => (
          <button key={runbook.id} onClick={() => setSelected(runbook)} className="card card-hover p-5 text-left">
            <div className="mb-2 flex items-center justify-between">
              <BookOpen className="h-5 w-5 text-primary-500" />
              {runbook.isCustom && <span className="badge-info">Custom</span>}
            </div>
            <h3 className="text-sm font-semibold text-secondary-900 dark:text-white">{runbook.title}</h3>
            <p className="mt-1 text-xs text-secondary-500 dark:text-secondary-400 line-clamp-2">{runbook.description}</p>
            <div className="mt-3 flex items-center gap-3 text-xs text-secondary-400">
              <span>{runbook.steps.length} steps</span>
              <span>{runbook.escalationContacts.length} contacts</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
