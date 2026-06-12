import { bbcCharset } from './charset';
import { bbcWordByToken } from './keywords';
import { LINE_NUMBER_TOKEN, decodeLineNumber } from './lineNumber';

/**
 * Convert a tokenized BBC BASIC program (the in-memory / SAVE layout produced by
 * {@link tokenizeProgram}) back into editable text. Spaces are stored verbatim,
 * so this is a faithful inverse of the tokenizer: keyword tokens become their
 * LIST spelling, the 0x8D line-number form becomes decimal digits, and every
 * other byte maps straight back through the charset.
 */
export function detokenizeProgram(program: Uint8Array): string {
  const lines: string[] = [];
  let p = 0;

  while (
    p + 3 < program.length &&
    program[p] === 0x0d &&
    program[p + 1] !== 0xff
  ) {
    const lineNo = (program[p + 1]! << 8) | program[p + 2]!;
    const len = program[p + 3]!;
    if (len < 4) break;
    const bodyEnd = Math.min(p + len, program.length);
    lines.push(`${lineNo}${decodeBody(program, p + 4, bodyEnd)}`);
    p += len;
  }

  return lines.join('\n') + (lines.length ? '\n' : '');
}

function decodeBody(program: Uint8Array, start: number, end: number): string {
  let text = '';
  let i = start;
  while (i < end) {
    const b = program[i]!;
    if (b === LINE_NUMBER_TOKEN && i + 3 < end) {
      text += decodeLineNumber(
        program[i + 1]!,
        program[i + 2]!,
        program[i + 3]!,
      );
      i += 4;
      continue;
    }
    const word = b >= 0x80 ? bbcWordByToken.get(b) : undefined;
    if (word !== undefined) {
      text += word;
      i++;
      continue;
    }
    text += bbcCharset.toUnicode([b]);
    i++;
  }
  return text;
}
