import breakout from './breakout.bas?raw';
import hello from './hello.bas?raw';
import snakeDodge from './dodger.bas?raw';
import type { SampleFile } from '../dialects/types';

export type { SampleFile };

/** ZX81 example programs (consumed by the zx81 dialect's `samples`). */
export const sampleFiles: SampleFile[] = [
  { name: 'hello.bas', title: 'Hello world', text: hello },
  { name: 'breakout.bas', title: 'Breakout', text: breakout },
  { name: 'dodger.bas', title: 'Dodger', text: snakeDodge },
];
