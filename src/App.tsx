import { useState, useEffect } from 'react';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { Layout } from '@/components/Layout';
import { DashboardPage } from '@/pages/DashboardPage';
import { SimulatePage } from '@/pages/SimulatePage';
import { SimulationRunner } from '@/pages/SimulationRunner';
import { ScenarioEditorPage } from '@/pages/ScenarioEditorPage';
import { RunbookLibraryPage } from '@/pages/RunbookLibraryPage';
import { LeaderboardPage } from '@/pages/LeaderboardPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { PostmortemPage } from '@/pages/PostmortemPage';
import { loadIdentity, saveIdentity, type UserIdentity } from '@/lib/storage';
import { Activity } from 'lucide-react';

export type Page =
  | { name: 'dashboard' }
  | { name: 'simulate' }
  | { name: 'runner'; scenarioId: string }
  | { name: 'editor' }
  | { name: 'runbooks' }
  | { name: 'leaderboard' }
  | { name: 'analytics' }
  | { name: 'postmortem'; runId: string; scenarioId: string; score: number };

function AppContent() {
  const [page, setPage] = useState<Page>({ name: 'dashboard' });
  const [identity, setIdentity] = useState<UserIdentity | null>(() => loadIdentity());

  useEffect(() => {
    if (identity) saveIdentity(identity);
  }, [identity]);

  const navigate = (p: Page) => setPage(p);

  let content;
  switch (page.name) {
    case 'dashboard':
      content = <DashboardPage navigate={navigate} identity={identity} />;
      break;
    case 'simulate':
      content = <SimulatePage navigate={navigate} identity={identity} setIdentity={setIdentity} />;
      break;
    case 'runner':
      content = (
        <SimulationRunner
          scenarioId={page.scenarioId}
          navigate={navigate}
          identity={identity}
        />
      );
      break;
    case 'editor':
      content = <ScenarioEditorPage />;
      break;
    case 'runbooks':
      content = <RunbookLibraryPage />;
      break;
    case 'leaderboard':
      content = <LeaderboardPage />;
      break;
    case 'analytics':
      content = <AnalyticsPage />;
      break;
    case 'postmortem':
      content = (
        <PostmortemPage
          runId={page.runId}
          scenarioId={page.scenarioId}
          score={page.score}
          navigate={navigate}
        />
      );
      break;
  }

  return (
    <Layout current={page.name} navigate={navigate}>
      {content}
    </Layout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
