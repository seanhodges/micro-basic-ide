import { useEffect, useState } from 'react';
import { useIdeStore } from './store';

export interface ProgramStats {
  bytes: number;
  errors: number;
}

/** Debounced tokenizer dry-run for the byte counter / error count. */
export function useProgramStats(): ProgramStats {
  const dialect = useIdeStore((s) => s.dialect);
  const source = useIdeStore((s) => s.source);
  const [stats, setStats] = useState<ProgramStats>({ bytes: 0, errors: 0 });

  useEffect(() => {
    const t = setTimeout(() => {
      const result = dialect.tokenize(source);
      setStats({ bytes: result.byteSize, errors: result.errors.length });
    }, 300);
    return () => clearTimeout(t);
  }, [dialect, source]);

  return stats;
}
