/**
 * Pure helpers for automatic BASIC line numbering.
 *
 * BASIC programs are a list of strictly-ascending numbered lines. These
 * functions compute the number a freshly-inserted line should get, cascade
 * existing numbers to free up space, and rewrite line-number references
 * (GOTO/GOSUB/RUN/LIST/LLIST) when a line is renumbered. They operate purely
 * on strings/numbers so the editor and the tests can share them.
 */

export interface BasicLine {
  /** Parsed line number, 1..9999. */
  lineNo: number;
  /** Text after the line number and its single optional separating space. */
  body: string;
  /** Original trimmed line text. */
  raw: string;
}

/** Smallest / largest legal ZX81 BASIC line number. */
export const MIN_LINE_NO = 1;
export const MAX_LINE_NO = 9999;

/** Keywords whose immediately-following integer literal is a line reference. */
const REF_KEYWORDS = ['GOTO', 'GOSUB', 'RUN', 'LIST', 'LLIST'];

/**
 * Parse source into ordered numbered lines. Blank lines and lines without a
 * leading number are skipped (the latter are in-progress / not reference-able).
 */
export function parseLines(source: string): BasicLine[] {
  const result: BasicLine[] = [];
  for (const raw of source.split('\n')) {
    const line = raw.trim();
    if (line === '') continue;
    const m = /^(\d+)\s?/.exec(line);
    if (!m) continue;
    result.push({
      lineNo: parseInt(m[1]!, 10),
      body: line.slice(m[0].length),
      raw: line,
    });
  }
  return result;
}

/**
 * Compute the number for a line being inserted between `prev` and `next`
 * (either may be null at the document edges).
 *
 * - End of file: previous + increment (an empty file starts at `increment`).
 * - Top of file: half of the following line, rounded down.
 * - Between two lines: the midpoint rounded down, unless the two are adjacent
 *   (no integer gap), in which case `makeSpace` is signalled and the freed slot
 *   `prev + 1` is returned for the caller to use after cascading.
 */
export function computeNewLineNumber(
  prev: number | null,
  next: number | null,
  increment: number,
): { lineNo: number; makeSpace: boolean } {
  if (next === null) {
    return { lineNo: (prev ?? 0) + increment, makeSpace: false };
  }
  if (prev === null) {
    const mid = Math.floor(next / 2);
    if (mid < MIN_LINE_NO) return { lineNo: MIN_LINE_NO, makeSpace: true };
    return { lineNo: mid, makeSpace: false };
  }
  const mid = Math.floor((prev + next) / 2);
  if (mid > prev && mid < next) return { lineNo: mid, makeSpace: false };
  return { lineNo: prev + 1, makeSpace: true };
}

/**
 * Cascade existing line numbers upward to free the slot `afterLineNo + 1`.
 * Walks the lines following `afterLineNo`, bumping each one that collides with
 * the required next slot until a natural gap is reached. Returns an old→new map
 * for every line that must move (empty if nothing needs to move, or if the
 * cascade would exceed MAX_LINE_NO — in which case the caller should abort).
 */
export function makeSpace(
  lines: BasicLine[],
  afterLineNo: number,
  increment: number,
): Map<number, number> {
  void increment; // single-slot cascade; increment kept for signature symmetry
  const map = new Map<number, number>();
  let expected = afterLineNo + 1; // slot we want freed; each line may only sit above it
  for (const line of lines) {
    if (line.lineNo <= afterLineNo) continue;
    if (line.lineNo > expected) break; // a gap exists at `expected`; cascade done
    const next = expected + 1;
    if (next > MAX_LINE_NO) return new Map(); // no room — caller aborts
    map.set(line.lineNo, next);
    expected = next;
  }
  return map;
}

/**
 * Rewrite line-number references (GOTO/GOSUB/RUN/LIST/LLIST targets) according
 * to `remap`. Numbers inside strings and after REM are left untouched, as are
 * computed targets (e.g. `GOTO X+1`) since only literal integers are matched.
 */
export function rewriteReferences(
  source: string,
  remap: Map<number, number>,
): string {
  if (remap.size === 0) return source;
  return source
    .split('\n')
    .map((line) => rewriteLineReferences(line, remap))
    .join('\n');
}

/** Rewrite references within a single physical line, skipping strings/REM. */
function rewriteLineReferences(
  line: string,
  remap: Map<number, number>,
): string {
  const refRe = new RegExp(`(${REF_KEYWORDS.join('|')})(\\s*)(\\d+)`, 'gi');
  let out = '';
  let i = 0;
  let inString = false;
  while (i < line.length) {
    const ch = line[i]!;
    if (inString) {
      out += ch;
      if (ch === '"') inString = false;
      i++;
      continue;
    }
    if (ch === '"') {
      out += ch;
      inString = true;
      i++;
      continue;
    }
    // REM at a statement boundary: the rest of the line is a comment.
    if (/[Rr]/.test(ch) && /^rem\b/i.test(line.slice(i))) {
      out += line.slice(i);
      break;
    }
    // Try a reference keyword anchored here.
    refRe.lastIndex = i;
    const m = refRe.exec(line);
    if (m && m.index === i) {
      const target = parseInt(m[3]!, 10);
      const replacement = remap.get(target);
      out += replacement === undefined ? m[0] : `${m[1]}${m[2]}${replacement}`;
      i += m[0].length;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/**
 * Apply a whole old→new shift map atomically: rewrite each moved line's own
 * number and every reference in one pass (against the original numbers, so a
 * 12→13/13→14 cascade is never double-applied), then re-sort ascending.
 */
export function applyRenumberMap(
  source: string,
  map: Map<number, number>,
): string {
  if (map.size === 0) return source;
  const referenced = rewriteReferences(source, map);
  const lines = parseLines(referenced).map((l) => {
    const moved = map.get(l.lineNo);
    return { ...l, lineNo: moved ?? l.lineNo };
  });
  return joinLines(lines);
}

/**
 * Renumber a single line from `oldNo` to `newNo`, rewriting all references to
 * it, then re-sorting the program into ascending order. No-op if `oldNo` is
 * absent or `oldNo === newNo`.
 */
export function renumberLine(
  source: string,
  oldNo: number,
  newNo: number,
): string {
  if (oldNo === newNo) return source;
  const lines = parseLines(source);
  if (!lines.some((l) => l.lineNo === oldNo)) return source;
  const remap = new Map([[oldNo, newNo]]);
  const referenced = rewriteReferences(source, remap);
  const renumbered = parseLines(referenced).map((l) =>
    l.lineNo === oldNo ? { ...l, lineNo: newNo } : l,
  );
  return joinLines(renumbered);
}

/** Re-emit parsed lines as "<lineNo> <body>", sorted ascending by number. */
function joinLines(lines: BasicLine[]): string {
  const sorted = [...lines].sort((a, b) => a.lineNo - b.lineNo);
  return sorted
    .map((l) => (l.body === '' ? `${l.lineNo}` : `${l.lineNo} ${l.body}`))
    .join('\n');
}

/** Leading line number of a physical line, or null if it has none. */
function lineNumberOf(physical: string): number | null {
  const m = /^\s*(\d+)\s?/.exec(physical);
  return m ? parseInt(m[1]!, 10) : null;
}

/** Nearest numbered lines immediately above and below physical index `idx`. */
function neighbours(
  physical: string[],
  idx: number,
): {
  prev: number | null;
  next: number | null;
} {
  let prev: number | null = null;
  for (let i = idx - 1; i >= 0; i--) {
    const n = lineNumberOf(physical[i]!);
    if (n !== null) {
      prev = n;
      break;
    }
  }
  let next: number | null = null;
  for (let i = idx + 1; i < physical.length; i++) {
    const n = lineNumberOf(physical[i]!);
    if (n !== null) {
      next = n;
      break;
    }
  }
  return { prev, next };
}

/**
 * Apply an old→new shift map to physical lines, preserving structure (blank and
 * unnumbered lines are kept in place, unlike {@link applyRenumberMap}). Rewrites
 * each numbered line's own prefix and any references, against the original
 * numbers in a single pass.
 */
function applyMapToPhysical(
  physical: string[],
  map: Map<number, number>,
): string[] {
  return physical.map((raw) => {
    const refd = rewriteReferences(raw, map);
    const m = /^(\s*)(\d+)(\s?)([\s\S]*)$/.exec(refd);
    if (!m) return refd;
    const mapped = map.get(parseInt(m[2]!, 10));
    return mapped === undefined ? refd : `${m[1]}${mapped}${m[3]}${m[4]}`;
  });
}

export interface InsertResult {
  /** New physical lines. */
  lines: string[];
  /** 0-based index of the inserted line (cursor should land at its end). */
  cursorLine: number;
}

/**
 * Insert an automatically-numbered line below physical index `idx` (where Enter
 * was pressed at the end of the line). If the current line has text but no
 * number it is numbered in place first (this bootstraps the very first line of
 * a file). Cascades existing numbers via {@link makeSpace} when there is no gap.
 * Returns null when numbering should be skipped (blank current line, or a
 * cascade that would overflow 9999) so the caller can fall back to a plain
 * newline.
 */
export function insertNumberedLineBelow(
  physical: string[],
  idx: number,
  increment: number,
): InsertResult | null {
  let lines = [...physical];
  const cur = lines[idx]!.trim();
  if (cur === '') return null;

  // 1. Ensure the current line carries a number.
  let curNo = lineNumberOf(lines[idx]!);
  if (curNo === null) {
    const { prev, next } = neighbours(lines, idx);
    const r = computeNewLineNumber(prev, next, increment);
    if (r.makeSpace) {
      const map = makeSpace(parseLines(lines.join('\n')), prev ?? 0, increment);
      if (map.size === 0) return null;
      lines = applyMapToPhysical(lines, map);
    }
    curNo = r.lineNo;
    lines[idx] = `${curNo} ${cur}`;
  }

  // 2. Number the new line being inserted below the current one.
  const { next } = neighbours(lines, idx);
  const r = computeNewLineNumber(curNo, next, increment);
  let newNo = r.lineNo;
  if (r.makeSpace) {
    const map = makeSpace(parseLines(lines.join('\n')), curNo, increment);
    if (map.size === 0) return null;
    lines = applyMapToPhysical(lines, map);
    newNo = curNo + 1;
  }

  lines.splice(idx + 1, 0, `${newNo} `);
  return { lines, cursorLine: idx + 1 };
}
