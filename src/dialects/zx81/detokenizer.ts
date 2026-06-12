import {
  zx81Charset,
  NEWLINE,
  NUMBER_MARKER,
  QUOTE,
  QUOTE_IMAGE,
} from './charset';
import { keywordByToken } from './keywords';

const WORDLIKE = /[A-Z0-9$"%▘▝▀▖▌▞▛▒█▟▙▄▜▐▚▗\\]/;

/**
 * Convert a tokenized ZX81 program area back into editable text.
 * Spacing is normalized (a single space wherever two word-like tokens meet);
 * semantics round-trip exactly, byte layout does after re-tokenizing.
 */
export function detokenizeProgram(program: Uint8Array): string {
  const lines: string[] = [];
  let p = 0;

  while (p + 4 <= program.length) {
    const lineNo = (program[p]! << 8) | program[p + 1]!;
    const len = program[p + 2]! | (program[p + 3]! << 8);
    p += 4;
    const end = Math.min(p + len, program.length);

    let text = `${lineNo} `;
    // Set after emitting a keyword word: insert a space before the next
    // word-like token so "GOTO" + "10" renders as "GOTO 10".
    let pendingBoundary = false;
    let inString = false;

    const emit = (s: string, wordlike: boolean) => {
      if (s === '') return;
      const lastChar = text[text.length - 1]!;
      const needsGap =
        (pendingBoundary && wordlike) ||
        (wordlike &&
          /^[A-Z]/.test(s) &&
          WORDLIKE.test(lastChar) &&
          s.length > 1);
      if (needsGap && lastChar !== ' ') text += ' ';
      text += s;
      pendingBoundary = false;
    };

    let i = p;
    while (i < end) {
      const b = program[i]!;
      if (b === NEWLINE) break;

      if (inString) {
        if (b === QUOTE) {
          text += '"';
          inString = false;
        } else if (b === QUOTE_IMAGE) {
          text += '""';
        } else {
          text += zx81Charset.toUnicode([b]);
        }
        i++;
        continue;
      }

      if (b === QUOTE) {
        emit('"', true);
        inString = true;
        i++;
        continue;
      }
      if (b === NUMBER_MARKER) {
        i += 6; // marker + 5-byte float; the printable digits precede it
        continue;
      }
      const kw = keywordByToken.get(b);
      if (kw) {
        if (kw.word === 'REM') {
          emit('REM', true);
          const rest = zx81Charset.toUnicode(program.slice(i + 1, end - 1));
          if (rest !== '') text += ' ' + rest;
          i = end;
          break;
        }
        if (/[A-Z]/.test(kw.word[0]!)) {
          emit(kw.word, true);
          pendingBoundary = true;
        } else {
          emit(kw.word, false); // symbol tokens: ** <= >= <>
        }
        i++;
        continue;
      }
      const s = zx81Charset.toUnicode([b]);
      emit(s, /[A-Z0-9$%\\]/.test(s[0] ?? ''));
      i++;
    }

    lines.push(text.replace(/\s+$/, ''));
    p += len;
  }

  return lines.join('\n') + (lines.length ? '\n' : '');
}
