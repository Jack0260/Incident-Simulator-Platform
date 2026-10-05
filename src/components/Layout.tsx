import { type ReactNode } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import {
  LayoutDashboard,
  Play,
  FileEdit,
  BookOpen,
  Trophy,
  BarChart3,
  Moon,
  Sun,
  Activity,
} from 'lucide-react';
import type { Page } from '@/App';

interface LayoutProps {
  current: string;
  navigate: (page: Page) => void;
  children: ReactNode;
}

const NAV_ITEMS = [
  { name: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { name: 'simulate', label: 'Run Simulation', icon: Play },
  { name: 'editor', label: 'Scenario Editor', icon: FileEdit },
  { name: 'runbooks', label: 'Runbook Library', icon: BookOpen },
  { name: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { name: 'analytics', label: 'Analytics', icon: BarChart3 },
];

export function Layout({ current, navigate, children }: LayoutProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="flex w-60 flex-col border-r border-secondary-200 bg-white dark:border-secondary-800 dark:bg-secondary-900">
        <div className="flex items-center gap-3 border-b border-secondary-200 px-5 py-4 dark:border-secondary-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-white">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-secondary-900 dark:text-white">Incident Simulator</h1>
            <p className="text-[10px] text-secondary-500 dark:text-secondary-400">Reliability Training Platform</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = current === item.name || (current === 'runner' && item.name === 'simulate') || (current === 'postmortem' && item.name === 'simulate');
            return (
              <button
                key={item.name}
                onClick={() => navigate({ name: item.name } as Page)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                    : 'text-secondary-600 hover:bg-secondary-100 dark:text-secondary-400 dark:hover:bg-secondary-800'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-secondary-200 p-3 dark:border-secondary-800">
          <button
            onClick={toggleTheme}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-secondary-600 transition-all hover:bg-secondary-100 dark:text-secondary-400 dark:hover:bg-secondary-800"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-secondary-50 dark:bg-secondary-950">
        {children}
      </main>
    </div>
  );
}
