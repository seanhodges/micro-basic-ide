import { CharsetError, type TokenizeError } from '../types';
import { bbcCharset } from './charset';
import { bbcKeywordsByLength, type BbcKeyword } from './keywords';
import { encodeLineNumber } from './lineNumber';

export interface TokenizedProgram {
  /** Full tokenized program: per-line records followed by the 0x0D 0xFF end. */
  bytes: Uint8Array;
  errors: TokenizeError[];
}

/** The 0x0D 0xFF that terminates a tokenized BBC BASIC program. */
const END_LO = 0x0d;
const END_HI = 0xff;

/** Highest line number BBC BASIC will store (0xFF00 is the end marker). */
const MAX_LINE = 65279;
/** Max tokenized body bytes per line (line length byte is body + 4 ≤ 255). */
const MAX_BODY = 251;

const ALNUM = /[A-Za-z0-9_]/;
const LETTER = /[A-Za-z]/;
const HEX = /[0-9A-Fa-f]/;

/**
 * Tokenize plain-text BBC BASIC II into the in-memory program layout the BASIC
 * ROM uses (and that SAVE writes to disc): for each line `0x0D`, the line number
 * big-endian, a length byte (= body length + 4) and the tokenized body, with a
 * trailing `0x0D 0xFF`. The output is byte-for-byte what the genuine ROM
 * tokeniser produces (regression-tested in tokenizer.test.ts), so the emulator
 * can POKE it straight in at PAGE.
 */
export function tokenizeProgram(source: string): TokenizedProgram {
  const out: number[] = [];
  const errors: TokenizeError[] = [];
  let prevLineNo = -1;

  const lines = source.split('\n');
  for (let li = 0; li < lines.length; li++) {
    let raw = lines[li]!;
    if (raw.endsWith('\r')) raw = raw.slice(0, -1);
    if (raw.trim() === '') continue;
    const editorLine = li + 1;

    const m = /^(\d+)(.*)$/.exec(raw);
    if (!m) {
      errors.push({
        line: editorLine,
        column: 0,
        message: 'Missing line number',
      });
      continue;
    }
    const lineNo = parseInt(m[1]!, 10);
    if (lineNo > MAX_LINE) {
      errors.push({
        line: editorLine,
        column: 0,
        message: `Line number ${lineNo} out of range 0-${MAX_LINE}`,
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

    const colOffset = m[1]!.length;
    const body = tokenizeBody(m[2]!, editorLine, colOffset, errors);
    if (body === null) continue; // error already recorded
    if (body.length > MAX_BODY) {
      errors.push({
        line: editorLine,
        column: 0,
        message: `Line too long (${body.length} > ${MAX_BODY} tokenized bytes)`,
      });
      continue;
    }

    prevLineNo = lineNo;
    out.push(0x0d, (lineNo >> 8) & 0xff, lineNo & 0xff, body.length + 4);
    for (const b of body) out.push(b);
  }

  out.push(END_LO, END_HI);
  return { bytes: Uint8Array.from(out), errors };
}

/** Match the longest keyword at body[i]; null if none applies here. */
function matchKeyword(
  body: string,
  i: number,
  statementStart: boolean,
): { kw: BbcKeyword; token: number; len: number } | null {
  for (const kw of bbcKeywordsByLength) {
    const len = kw.word.length;
    if (!body.startsWith(kw.word, i)) continue;
    // "Conditional" keywords ending in a letter are only tokenized when not
    // immediately followed by another name character (so TIMER stays a name).
    if (kw.conditional && LETTER.test(kw.word[len - 1]!)) {
      const next = body[i + len];
      if (next !== undefined && ALNUM.test(next)) continue;
    }
    const token =
      statementStart && kw.statementToken !== undefined
        ? kw.statementToken
        : kw.token;
    return { kw, token, len };
  }
  return null;
}

function tokenizeBody(
  body: string,
  editorLine: number,
  colOffset: number,
  errors: TokenizeError[],
): number[] | null {
  const out: number[] = [];
  let i = 0;
  let statementStart = true;
  let lino = false;
  let failed = false;

  const emit = (ch: string, at: number): boolean => {
    try {
      for (const b of bbcCharset.toMachine(ch)) out.push(b);
      return true;
    } catch (e) {
      if (e instanceof CharsetError) {
        errors.push({
          line: editorLine,
          column: colOffset + at,
          message: e.message,
        });
        failed = true;
        return false;
      }
      throw e;
    }
  };

  while (i < body.length) {
    const ch = body[i]!;

    // Spaces are copied verbatim and leave statement/line-number state intact.
    if (ch === ' ' || ch === '\t') {
      out.push(ch.charCodeAt(0));
      i++;
      continue;
    }

    // Line-number mode: GOTO/THEN/… encode the following constants.
    if (lino) {
      if (ch >= '0' && ch <= '9') {
        let j = i;
        while (j < body.length && body[j]! >= '0' && body[j]! <= '9') j++;
        const n = parseInt(body.slice(i, j), 10) & 0xffff;
        out.push(...encodeLineNumber(n));
        i = j;
        statementStart = false;
        continue;
      }
      if (ch === ',') {
        out.push(0x2c);
        i++;
        continue; // a list of line numbers (ON … GOTO a,b,c)
      }
      lino = false; // anything else ends line-number mode
    }

    // '*' at the start of a statement: an OS command, rest of line is literal.
    if (statementStart && ch === '*') {
      while (i < body.length) {
        if (!emit(body[i]!, i)) return null;
        i++;
      }
      break;
    }

    // Keywords and variable names.
    if (LETTER.test(ch)) {
      const match = matchKeyword(body, i, statementStart);
      if (match) {
        const { kw, token, len } = match;
        out.push(token);
        i += len;

        if (kw.word === 'REM' || kw.word === 'DATA') {
          while (i < body.length) {
            if (!emit(body[i]!, i)) return null;
            i++;
          }
          statementStart = false;
          continue;
        }
        if (kw.word === 'PROC' || kw.word === 'FN') {
          while (i < body.length && ALNUM.test(body[i]!)) {
            if (!emit(body[i]!, i)) return null;
            i++;
          }
          statementStart = false;
          continue;
        }
        if (kw.lino) lino = true;
        statementStart = kw.word === 'THEN' || kw.word === 'ELSE';
        continue;
      }
      // Not a keyword — consume the whole variable name verbatim.
      let j = i;
      while (j < body.length && ALNUM.test(body[j]!)) j++;
      if (j < body.length && (body[j] === '$' || body[j] === '%')) j++;
      for (; i < j; i++) if (!emit(body[i]!, i)) return null;
      statementStart = false;
      continue;
    }

    // String literal: copied verbatim, nothing inside is tokenized.
    if (ch === '"') {
      out.push(0x22);
      i++;
      while (i < body.length && body[i] !== '"') {
        if (!emit(body[i]!, i)) return null;
        i++;
      }
      if (i < body.length) {
        out.push(0x22);
        i++;
      }
      statementStart = false;
      continue;
    }

    // Hex constant: '&' then a run of hex digits, copied so an A–F run isn't
    // mistaken for a keyword.
    if (ch === '&') {
      out.push(0x26);
      i++;
      while (i < body.length && HEX.test(body[i]!)) {
        out.push(body.charCodeAt(i));
        i++;
      }
      statementStart = false;
      continue;
    }

    // ':' opens a new statement.
    if (ch === ':') {
      out.push(0x3a);
      i++;
      statementStart = true;
      continue;
    }

    // Anything else (digits, operators, punctuation) is copied verbatim.
    if (!emit(ch, i)) return null;
    statementStart = false;
    i++;
  }

  return failed ? null : out;
}
