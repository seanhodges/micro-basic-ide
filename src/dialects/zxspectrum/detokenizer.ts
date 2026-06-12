import { spectrumCharset, ENTER, NUMBER_MARKER, QUOTE } from './charset';
import { keywordByToken } from './keywords';

const WORDLIKE = /[A-Za-z0-9$↑£©▘▝▀▖▌▞▛▗▚▐▜▄▙▟█]/;

/**
 * Convert a tokenized ZX Spectrum program area back into editable text.
 * Spacing is normalized (a single space wherever two word-like tokens meet);
 * the inline 5-byte numeric forms are dropped, keeping the printed digits.
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
    let pendingBoundary = false;
    let inString = false;

    const emit = (s: string, wordlike: boolean) => {
      if (s === '') return;
      const lastChar = text[text.length - 1]!;
      const firstChar = s[0]!;
      const needsGap =
        (pendingBoundary && (wordlike || WORDLIKE.test(firstChar))) ||
        (wordlike && /[A-Za-z]/.test(firstChar) && WORDLIKE.test(lastChar));
      if (needsGap && lastChar !== ' ') text += ' ';
      text += s;
      pendingBoundary = false;
    };

    let i = p;
    while (i < end) {
      const b = program[i]!;
      if (b === ENTER) break;

      if (inString) {
        if (b === QUOTE) {
          text += '"';
          inString = false;
        } else {
          text += spectrumCharset.toUnicode([b]);
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
        i += 6; // marker + 5-byte form; the printable digits precede it
        continue;
      }
      const kw = keywordByToken.get(b);
      if (kw) {
        if (kw.word === 'REM') {
          emit('REM', true);
          const rest = spectrumCharset.toUnicode(program.slice(i + 1, end));
          if (rest !== '') text += ' ' + rest.replace(/[\r\n]+$/, '');
          i = end;
          break;
        }
        emit(kw.word, /[A-Za-z]/.test(kw.word[0]!));
        if (/[A-Za-z#]/.test(kw.word[kw.word.length - 1]!)) {
          pendingBoundary = true;
        }
        i++;
        continue;
      }
      const s = spectrumCharset.toUnicode([b]);
      emit(s, WORDLIKE.test(s[0] ?? ''));
      i++;
    }

    lines.push(text.replace(/\s+$/, ''));
    p += len;
  }

  return lines.join('\n') + (lines.length ? '\n' : '');
}
