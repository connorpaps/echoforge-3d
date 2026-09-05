'use client';

import { useState } from 'react';
import { loadProject, saveProject } from '@/lib/persistence/projectPersistence';
import { useSceneStore } from '@/lib/stores/useSceneStore';

export function ProjectActions() {
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');

  const run = async (action: 'save' | 'load') => {
    if (busy) return;
    setBusy(action);
    setFeedback('');
    try {
      if (action === 'save') {
        await saveProject(useSceneStore.getState());
        setFeedback('Project saved');
      } else {
        const loaded = await loadProject();
        if (!loaded) {
          setFeedback('No saved project found');
          return;
        }
        useSceneStore.setState({
          entities: loaded.entities,
          terrainHeightmap: loaded.terrainHeightmap,
          selectedEntityId: null,
          history: { past: [], future: [] },
        });
        setFeedback('Project loaded');
      }
    } catch (error) {
      console.error(`[project] ${action} failed`, error);
      setFeedback(`Project ${action} failed`);
    } finally {
      setBusy(null);
    }
  };

  const newProject = () => {
    useSceneStore.setState({
      entities: {},
      terrainHeightmap: null,
      selectedEntityId: null,
      activeMode: 'editor',
      history: { past: [], future: [] },
    });
    setFeedback('New project created');
  };

  return (
    <div className="flex items-center gap-1.5" aria-label="Project actions">
      <button type="button" onClick={() => void run('save')} disabled={busy !== null}>
        {busy === 'save' ? 'Saving…' : 'Save Project'}
      </button>
      <button type="button" onClick={() => void run('load')} disabled={busy !== null}>
        {busy === 'load' ? 'Loading…' : 'Load Project'}
      </button>
      <button type="button" onClick={newProject} disabled={busy !== null}>
        New Project
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {feedback}
      </span>
    </div>
  );
}
