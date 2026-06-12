import type { SampleFile } from '../types';
import hello from './samples/hello.bas?raw';
import circles from './samples/circles.bas?raw';
import bounce from './samples/bounce.bas?raw';

/** ZX Spectrum example programs; the first is the starter for a fresh document. */
export const spectrumSamples: SampleFile[] = [
  { name: 'hello.bas', title: 'Hello world', text: hello },
  { name: 'circles.bas', title: 'Colour circles', text: circles },
  { name: 'bounce.bas', title: 'Bouncing ball', text: bounce },
];
