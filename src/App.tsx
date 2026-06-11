import { useEffect } from 'react';
import { useIdeStore } from './app/store';
import { Toolbar } from './components/Toolbar';
import { Workspace } from './components/Workspace';
import { AiSettingsDialog } from './components/AiSettingsDialog';
import { TransferDialog } from './components/TransferDialog';
import { StatusBar } from './components/StatusBar';
import { saveAutosave } from './storage/settings';
import { isMobileViewport } from './app/useMediaQuery';

export default function App() {
  const requestRun = useIdeStore((s) => s.requestRun);
  const runRequest = useIdeStore((s) => s.runRequest);

  // Autosave the document every 2s while dirty
  useEffect(() => {
    const interval = setInterval(() => {
      const { dirty, fileName, source } = useIdeStore.getState();
      if (dirty) saveAutosave(fileName, source);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Ctrl/Cmd+Enter = run
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        requestRun();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [requestRun]);

  // On mobile, jump to the Preview tab whenever a run is requested
  // (covers the toolbar Run button, the FAB, and Ctrl+Enter)
  useEffect(() => {
    if (runRequest > 0 && isMobileViewport()) {
      useIdeStore.getState().setMobileTab('preview');
    }
  }, [runRequest]);

  return (
    <div className="app">
      <Toolbar />
      <Workspace />
      <StatusBar />
      <AiSettingsDialog />
      <TransferDialog />
    </div>
  );
}
