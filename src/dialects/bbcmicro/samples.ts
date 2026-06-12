import type { SampleFile } from '../types';
import hello from './samples/hello.bas?raw';
import bounce from './samples/bounce.bas?raw';

/** BBC Micro example programs; the first is the starter for a fresh document. */
export const bbcSamples: SampleFile[] = [
  { name: 'hello.bas', title: 'Hello world', text: hello },
  { name: 'bounce.bas', title: 'Bouncing ball', text: bounce },
];
