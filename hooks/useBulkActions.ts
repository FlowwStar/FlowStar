import { useState } from 'react';

export type BulkActionStatus = 'idle' | 'running' | 'done';

export interface StreamResult {
  id:      string;
  success: boolean;
  error?:  string;
}

export function useBulkActions() {
  const [status,   setStatus]   = useState<BulkActionStatus>('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results,  setResults]  = useState<StreamResult[]>([]);

  async function runBulk(
    ids:    string[],
    action: (id: string) => Promise<void>,
  ) {
    setStatus('running');
    setProgress({ done: 0, total: ids.length });
    setResults([]);

    const out: StreamResult[] = [];

    for (const id of ids) {
      try {
        await action(id);
        out.push({ id, success: true });
      } catch (err) {
        out.push({ id, success: false, error: (err as Error).message });
      }
      setProgress(p => ({ ...p, done: p.done + 1 }));
      setResults([...out]);
    }

    setStatus('done');
  }

  const succeeded = results.filter(r =>  r.success).length;
  const failed    = results.filter(r => !r.success).length;

  return { status, progress, results, succeeded, failed, runBulk };
}