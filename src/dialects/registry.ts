import type { Dialect } from './types';
import { zx81 } from './zx81';
import { zxspectrum } from './zxspectrum';

export const dialects: Dialect[] = [zx81, zxspectrum];

export function getDialect(id: string): Dialect {
  const d = dialects.find((d) => d.id === id);
  if (!d) throw new Error(`Unknown dialect: ${id}`);
  return d;
}
