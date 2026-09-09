'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createWorkerClient,
  type WorkerClient,
} from '@/workers/workerFactory';
import { createWorker, type WorkerId } from '@/workers/workerRegistry';
import type { WorkerStatus } from '@/workers/workerTypes';

/**
 * React binding for a typed ML worker. Lazily creates the worker on mount,
 * sends INIT, and exposes a promise-based `request` for task calls.
 *
 * In E2E mode (NEXT_PUBLIC_E2E="true") `createWorker` returns the
 * deterministic fixture client instead of a model-backed worker.
 */
export function useWorker(id: WorkerId) {
  const [status, setStatus] = useState<WorkerStatus>('idle');
  const clientRef = useRef<WorkerClient | null>(null);

  useEffect(() => {
    const client = createWorkerClient(createWorker(id));
    clientRef.current = client;
    const unsubscribe = client.onStatus(setStatus);
    let active = true;

    client.request('INIT').catch((err: unknown) => {
      if (!active) return;
      console.error(`[worker:${id}] initialization failed`, err);
      setStatus('error');
    });

    return () => {
      active = false;
      unsubscribe();
      client.dispose();
      clientRef.current = null;
    };
  }, [id]);

  const request = useCallback(
    <TRes,>(type: string, payload?: unknown, transfer?: Transferable[]) => {
      const client = clientRef.current;
      if (!client) {
        return Promise.reject(new Error('Worker not initialized'));
      }
      return client.request<TRes>(type, payload, transfer);
    },
    [],
  );

  return { request, status };
}
