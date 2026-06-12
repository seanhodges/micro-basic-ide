import { CharsetError, type TokenizeError } from '../types';
import { spectrumCharset, ENTER, NUMBER_MARKER, QUOTE } from './charset';
import {
  keywordsByLength,
  keywordAliases,
  statementKeywords,
} from './keywords';
import { encodeSpectrumNumber } from './numbers';

export interface TokenizedProgram {
  /** Tokenized program area (concatenated lines), as stored from PROG. */
  bytes: Uint8Array;
  errors: TokenizeError[];
}

const IDENT = /[A-Za-z0-9$]/;
const WS = /[ \t]/;

/** Canonical-word matches, plus glued aliases, longest first. */
const MATCHERS: { word: string; canonical: string }[] = [
  ...keywordsByLength.map((k) => ({ word: k.word, canonical: k.word })),
  ...Object.entries(keywordAliases).map(([alias, canonical]) => ({
    word: alias,
    canonical,
  })),
].sort((a, b) => b.word.length - a.word.length);

const canonicalToken = new Map(keywordsByLength.map((k) => [k.word, k.token]));

/**
 * Tokenize plain-text ZX Spectrum BASIC into the program-area byte layout:
 * per line — u16 BE line number, u16 LE length (of body + ENTER), tokenized
 * body, 0x0D.
 */
export function tokenizeProgram(source: string): TokenizedProgram {
  const out: number[] = [];
  const errors: TokenizeError[] = [];
  let prevLineNo = 0;

  const lines = source.split('\n');
  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li]!;
    const text = raw.trim();
    if (text === '') continue;
    const editorLine = li + 1;

    const m = /^(\d+)\s?/.exec(text);
    if (!m) {
      errors.push({
        line: editorLine,
        column: 0,
        message: 'Missing line number',
      });
      continue;
    }
    const lineNo = parseInt(m[1]!, 10);
    if (lineNo < 1 || lineNo > 9999) {
      errors.push({
        line: editorLine,
        column: 0,
        message: `Line number ${lineNo} out of range 1-9999`,
      });
      continue;
    }
    if (lineNo <= prevLineNo) {
      errors.push({
        line: editorLine,
        column: 0,
        message: `Line number ${lineNo} not greater than previous line ${prevLineNo}`,
      });
      continue;
    }

    const body = text.slice(m[0].length);
    const tokens = tokenizeBody(body, editorLine, m[0].length, errors);
    if (tokens === null) continue; // error already recorded

    prevLineNo = lineNo;
    out.push((lineNo >> 8) & 0xff, lineNo & 0xff);
    const len = tokens.length + 1; // body + ENTER terminator
    out.push(len & 0xff, (len >> 8) & 0xff);
    out.push(...tokens, ENTER);
  }

  return { bytes: Uint8Array.from(out), errors };
}

/** Match a (possibly multi-word) keyword at position i; -1 on no match. */
function matchKeywordAt(upper: string, i: number, word: string): number {
  let si = i;
  let wi = 0;
  while (wi < word.length) {
    const wc = word[wi]!;
    if (wc === ' ') {
      if (!WS.test(upper[si] ?? '')) return -1;
      while (WS.test(upper[si] ?? '')) si++;
      wi++;
    } else {
      if (upper[si] !== wc) return -1;
      si++;
      wi++;
    }
  }
  return si - i;
}

function tokenizeBody(
  body: string,
  editorLine: number,
  colOffset: number,
  errors: TokenizeError[],
): number[] | null {
  const out: number[] = [];
  const upper = body.toUpperCase();
  let i = 0;
  let firstWordChecked = false;
  let prevSignificant = '';

  const fail = (message: string, at: number): null => {
    errors.push({ line: editorLine, column: colOffset + at, message });
    return null;
  };

  const emitChar = (ch: string, at: number): boolean => {
    try {
      out.push(...spectrumCharset.toMachine(ch));
      return true;
    } catch (e) {
      if (e instanceof CharsetError) {
        fail(e.message, at);
        return false;
      }
      throw e;
    }
  };

  while (i < body.length) {
    const ch = body[i]!;

    if (ch === ' ' || ch === '\t') {
      prevSignificant = ' ';
      i++;
      continue;
    }

    // Strings: "" inside a string stores a doubled quote.
    if (ch === '"') {
      out.push(QUOTE);
      i++;
      let closed = false;
      while (i < body.length) {
        if (body[i] === '"') {
          if (body[i + 1] === '"') {
            out.push(QUOTE, QUOTE);
            i += 2;
            continue;
          }
          out.push(QUOTE);
          i++;
          closed = true;
          break;
        }
        if (!emitChar(body[i]!, i)) return null;
        i++;
      }
      if (!closed) return fail('Unterminated string', body.length - 1);
      prevSignificant = '"';
      continue;
    }

    // Keywords (longest match, with word-boundary checks for word keywords).
    let matched = false;
    for (const kw of MATCHERS) {
      const consumed = matchKeywordAt(upper, i, kw.word);
      if (consumed < 0) continue;
      const firstCh = kw.word[0]!;
      const lastCh = kw.word[kw.word.length - 1]!;
      if (/[A-Z]/.test(firstCh) && IDENT.test(prevSignificant)) continue;
      if (/[A-Z]/.test(lastCh)) {
        const next = upper[i + consumed];
        if (next !== undefined && IDENT.test(next)) continue;
      }

      if (!firstWordChecked) {
        if (!statementKeywords.has(kw.canonical)) {
          return fail(
            `Statement must start with a command keyword (got ${kw.word})`,
            i,
          );
        }
        firstWordChecked = true;
      }

      const token = canonicalToken.get(kw.canonical)!;
      out.push(token);
      i += consumed;
      prevSignificant = ' ';
      matched = true;

      if (kw.canonical === 'REM') {
        // Rest of the line is literal text.
        if (!emitRest(out, body, i, fail)) return null;
        i = body.length;
      } else if (kw.canonical === 'BIN') {
        i = emitBin(out, body, upper, i);
        prevSignificant = '0';
      }
      break;
    }
    if (matched) continue;

    if (!firstWordChecked) {
      return fail(
        'Statement must start with a command keyword (e.g. LET, PRINT, IF…)',
        i,
      );
    }

    // Numeric literal not continuing an identifier.
    if (/[0-9.]/.test(ch) && !IDENT.test(prevSignificant)) {
      const numMatch = /^(\d+(\.\d*)?|\.\d+)(E[+-]?\d+)?/.exec(upper.slice(i));
      if (numMatch && numMatch[0] !== '.') {
        const numText = numMatch[0];
        const value = parseFloat(numText);
        for (const c of numText) out.push(c.charCodeAt(0));
        out.push(NUMBER_MARKER);
        try {
          out.push(...encodeSpectrumNumber(value));
        } catch {
          return fail(`Number out of range: ${numText}`, i);
        }
        i += numText.length;
        prevSignificant = '0';
        continue;
      }
    }

    if (!emitChar(body[i]!, i)) return null;
    prevSignificant = body[i]!;
    i++;
  }

  if (!firstWordChecked) {
    return fail('Line has a number but no statement', 0);
  }
  return out;
}

/** Emit the rest of the line verbatim (REM body). */
function emitRest(
  out: number[],
  body: string,
  start: number,
  fail: (m: string, at: number) => null,
): boolean {
  let j = start;
  if (body[j] === ' ') j++;
  while (j < body.length) {
    try {
      out.push(...spectrumCharset.toMachine(body[j]!));
    } catch (e) {
      if (e instanceof CharsetError) {
        fail(e.message, j);
        return false;
      }
      throw e;
    }
    j++;
  }
  return true;
}

/** Emit the binary digits after BIN plus the inline value form. */
function emitBin(
  out: number[],
  body: string,
  upper: string,
  start: number,
): number {
  let j = start;
  while (WS.test(body[j] ?? '')) {
    out.push(body[j]!.charCodeAt(0));
    j++;
  }
  const digits = /^[01]+/.exec(upper.slice(j));
  if (!digits) return j;
  for (const c of digits[0]) out.push(c.charCodeAt(0));
  out.push(NUMBER_MARKER, ...encodeSpectrumNumber(parseInt(digits[0], 2)));
  return j + digits[0].length;
}
