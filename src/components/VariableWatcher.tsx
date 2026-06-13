import { useEffect, useState } from 'react';
import type { MachineEmulator, MachineVariable } from '../dialects/types';

interface Props {
  /** Accessor for the live emulator (null until a program has been run). */
  getMachine: () => MachineEmulator | null;
  /** Whether the emulator is currently running. */
  running: boolean;
}

/** Poll interval for refreshing variable values (ms). ~6–7Hz reads cheaply. */
const POLL_MS = 150;

const KIND_LABELS: Record<MachineVariable['kind'], string> = {
  number: 'number',
  string: 'string',
  'number-array': 'num array',
  'string-array': 'str array',
};

/**
 * Read-only live view of the running program's BASIC variables. Polls the
 * emulator a few times a second rather than every frame — imperceptible lag
 * for a debug panel, and it keeps a large table from re-rendering at 50Hz.
 *
 * The value is rendered inside a dedicated span so a future "edit at runtime"
 * mode can swap it for an input without restructuring the row.
 */
export function VariableWatcher({ getMachine, running }: Props) {
  const [vars, setVars] = useState<MachineVariable[]>([]);

  useEffect(() => {
    if (!running) {
      setVars([]);
      return;
    }
    const read = () => {
      const machine = getMachine();
      setVars(machine?.readVariables ? machine.readVariables() : []);
    };
    read();
    const id = setInterval(read, POLL_MS);
    return () => clearInterval(id);
  }, [running, getMachine]);

  // A machine only exists once a program has run; only then can we tell whether
  // this machine supports introspection (e.g. the BBC Micro does not yet).
  const machine = getMachine();
  if (machine && typeof machine.readVariables !== 'function') {
    return (
      <div className="watcher-empty">
        Variable watching isn’t available for this machine yet.
      </div>
    );
  }
  if (!running) {
    return (
      <div className="watcher-empty">
        Run a program to inspect its variables.
      </div>
    );
  }
  if (vars.length === 0) {
    return <div className="watcher-empty">No variables defined yet.</div>;
  }

  return (
    <table className="watcher-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Type</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        {vars.map((v) => (
          <tr key={v.name}>
            <td className="watcher-name">{v.name}</td>
            <td className="watcher-kind">{KIND_LABELS[v.kind]}</td>
            <td className="watcher-value">
              <span className="watcher-value-text">{v.value}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
