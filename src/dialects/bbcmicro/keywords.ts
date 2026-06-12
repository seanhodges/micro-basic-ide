import type { KeywordInfo } from '../types';

/**
 * One BBC BASIC II keyword, with the extra flags the native tokenizer needs on
 * top of the editor-facing {@link KeywordInfo}. Tokens are the genuine BASIC II
 * values; the flags were derived from (and are regression-tested against) the
 * real BASIC ROM tokeniser — see tokenizer.test.ts.
 */
export interface BbcKeyword extends KeywordInfo {
  /**
   * Canonical spelling as the ROM matches and LISTs it. Print formatters and
   * string functions keep the trailing '(' that is part of the token
   * (e.g. "TAB(", "LEFT$("); the editor view strips it (see {@link bbcKeywords}).
   */
  word: string;
  /**
   * Statement-position token for the five pseudo-variables (PTR/PAGE/TIME/
   * LOMEM/HIMEM). When the keyword opens a statement (e.g. `TIME=0`) the ROM
   * emits this form (= token + 0x40) instead of the function-position token.
   */
  statementToken?: number;
  /**
   * "Conditional": only tokenize when the character following the keyword is
   * not alphanumeric, so e.g. the variables TIMER and ENDING are left intact.
   */
  conditional?: boolean;
  /**
   * After this keyword the ROM encodes following line-number constants in the
   * three-byte 0x8D form (GOTO/GOSUB/RESTORE/THEN/ELSE/LIST/…).
   */
  lino?: boolean;
}

/**
 * The complete BBC BASIC II keyword table, tokens 0x80–0xFF (0x8D is reserved
 * for the inline line-number form and has no keyword). Ordered by token.
 */
export const bbcKeywordTable: BbcKeyword[] = [
  { word: 'AND', token: 0x80, kind: 'operator', doc: 'Bitwise/logical AND.' },
  { word: 'DIV', token: 0x81, kind: 'operator', doc: 'Integer division.' },
  { word: 'EOR', token: 0x82, kind: 'operator', doc: 'Bitwise exclusive OR.' },
  { word: 'MOD', token: 0x83, kind: 'operator', doc: 'Integer remainder.' },
  { word: 'OR', token: 0x84, kind: 'operator', doc: 'Bitwise/logical OR.' },
  {
    word: 'ERROR',
    token: 0x85,
    kind: 'command',
    doc: 'Part of ON ERROR — trap runtime errors.',
  },
  {
    word: 'LINE',
    token: 0x86,
    kind: 'command',
    doc: 'INPUT LINE reads a whole line of text.',
  },
  {
    word: 'OFF',
    token: 0x87,
    kind: 'command',
    doc: 'Switch something off, e.g. TRACE OFF.',
  },
  { word: 'STEP', token: 0x88, kind: 'command', doc: 'Loop increment in FOR.' },
  {
    word: 'SPC',
    token: 0x89,
    kind: 'function',
    signature: 'SPC(n)',
    doc: 'Print n spaces.',
  },
  {
    word: 'TAB(',
    token: 0x8a,
    kind: 'function',
    signature: 'TAB(x[,y])',
    doc: 'Position the cursor within PRINT.',
  },
  {
    word: 'ELSE',
    token: 0x8b,
    kind: 'command',
    lino: true,
    doc: 'Alternative branch of IF…THEN.',
  },
  {
    word: 'THEN',
    token: 0x8c,
    kind: 'command',
    lino: true,
    doc: 'Follows the condition in IF.',
  },
  {
    word: 'OPENIN',
    token: 0x8e,
    kind: 'function',
    signature: 'OPENIN(name)',
    doc: 'Open a file for input; returns a channel.',
  },
  {
    word: 'PTR',
    token: 0x8f,
    kind: 'function',
    statementToken: 0xcf,
    conditional: true,
    signature: 'PTR#chan',
    doc: 'File pointer (read/assign).',
  },
  {
    word: 'PAGE',
    token: 0x90,
    kind: 'function',
    statementToken: 0xd0,
    conditional: true,
    doc: 'Address of the start of BASIC program memory (read/assign).',
  },
  {
    word: 'TIME',
    token: 0x91,
    kind: 'function',
    statementToken: 0xd1,
    conditional: true,
    doc: 'Centisecond timer (read/assign).',
  },
  {
    word: 'LOMEM',
    token: 0x92,
    kind: 'function',
    statementToken: 0xd2,
    conditional: true,
    doc: 'Address of the bottom of variable memory (read/assign).',
  },
  {
    word: 'HIMEM',
    token: 0x93,
    kind: 'function',
    statementToken: 0xd3,
    conditional: true,
    doc: 'Address of the top of available memory (read/assign).',
  },
  {
    word: 'ABS',
    token: 0x94,
    kind: 'function',
    signature: 'ABS(n)',
    doc: 'Absolute value.',
  },
  {
    word: 'ACS',
    token: 0x95,
    kind: 'function',
    signature: 'ACS(n)',
    doc: 'Arc cosine (radians).',
  },
  {
    word: 'ADVAL',
    token: 0x96,
    kind: 'function',
    signature: 'ADVAL(n)',
    doc: 'Read an analogue/buffer device.',
  },
  {
    word: 'ASC',
    token: 0x97,
    kind: 'function',
    signature: 'ASC(a$)',
    doc: 'Character code of the first character.',
  },
  {
    word: 'ASN',
    token: 0x98,
    kind: 'function',
    signature: 'ASN(n)',
    doc: 'Arc sine (radians).',
  },
  {
    word: 'ATN',
    token: 0x99,
    kind: 'function',
    signature: 'ATN(n)',
    doc: 'Arctangent (radians).',
  },
  {
    word: 'BGET',
    token: 0x9a,
    kind: 'function',
    conditional: true,
    signature: 'BGET#chan',
    doc: 'Read one byte from an open file.',
  },
  {
    word: 'COS',
    token: 0x9b,
    kind: 'function',
    signature: 'COS(n)',
    doc: 'Cosine (radians).',
  },
  {
    word: 'COUNT',
    token: 0x9c,
    kind: 'function',
    conditional: true,
    doc: 'Number of characters printed since the last newline.',
  },
  {
    word: 'DEG',
    token: 0x9d,
    kind: 'function',
    signature: 'DEG(n)',
    doc: 'Convert radians to degrees.',
  },
  {
    word: 'ERL',
    token: 0x9e,
    kind: 'function',
    conditional: true,
    doc: 'Line number of the last error.',
  },
  {
    word: 'ERR',
    token: 0x9f,
    kind: 'function',
    conditional: true,
    doc: 'Error number of the last error.',
  },
  {
    word: 'EVAL',
    token: 0xa0,
    kind: 'function',
    signature: 'EVAL(a$)',
    doc: 'Evaluate a string as an expression.',
  },
  {
    word: 'EXP',
    token: 0xa1,
    kind: 'function',
    signature: 'EXP(n)',
    doc: 'e to the power n.',
  },
  {
    word: 'EXT',
    token: 0xa2,
    kind: 'function',
    conditional: true,
    signature: 'EXT#chan',
    doc: 'Length of an open file.',
  },
  {
    word: 'FALSE',
    token: 0xa3,
    kind: 'function',
    conditional: true,
    doc: 'The constant 0.',
  },
  {
    word: 'FN',
    token: 0xa4,
    kind: 'function',
    signature: 'FNname[(args)]',
    doc: 'Call a named function.',
  },
  {
    word: 'GET',
    token: 0xa5,
    kind: 'function',
    doc: 'Wait for a key, return its code.',
  },
  {
    word: 'INKEY',
    token: 0xa6,
    kind: 'function',
    signature: 'INKEY(t)',
    doc: 'Read a key with timeout t centiseconds (-1 if none).',
  },
  {
    word: 'INSTR(',
    token: 0xa7,
    kind: 'function',
    signature: 'INSTR(a$,b$[,start])',
    doc: 'Find b$ within a$.',
  },
  {
    word: 'INT',
    token: 0xa8,
    kind: 'function',
    signature: 'INT(n)',
    doc: 'Round towards minus infinity.',
  },
  {
    word: 'LEN',
    token: 0xa9,
    kind: 'function',
    signature: 'LEN(a$)',
    doc: 'String length.',
  },
  {
    word: 'LN',
    token: 0xaa,
    kind: 'function',
    signature: 'LN(n)',
    doc: 'Natural logarithm.',
  },
  {
    word: 'LOG',
    token: 0xab,
    kind: 'function',
    signature: 'LOG(n)',
    doc: 'Base-10 logarithm.',
  },
  { word: 'NOT', token: 0xac, kind: 'operator', doc: 'Logical/bitwise NOT.' },
  {
    word: 'OPENUP',
    token: 0xad,
    kind: 'function',
    signature: 'OPENUP(name)',
    doc: 'Open a file for update; returns a channel.',
  },
  {
    word: 'OPENOUT',
    token: 0xae,
    kind: 'function',
    signature: 'OPENOUT(name)',
    doc: 'Open a file for output; returns a channel.',
  },
  {
    word: 'PI',
    token: 0xaf,
    kind: 'function',
    conditional: true,
    doc: 'The constant π.',
  },
  {
    word: 'POINT(',
    token: 0xb0,
    kind: 'function',
    signature: 'POINT(x,y)',
    doc: 'Logical colour at graphics point x,y.',
  },
  {
    word: 'POS',
    token: 0xb1,
    kind: 'function',
    conditional: true,
    doc: 'Text cursor column.',
  },
  {
    word: 'RAD',
    token: 0xb2,
    kind: 'function',
    signature: 'RAD(n)',
    doc: 'Convert degrees to radians.',
  },
  {
    word: 'RND',
    token: 0xb3,
    kind: 'function',
    conditional: true,
    signature: 'RND[(n)]',
    doc: 'Random number: RND(n) gives 1..n.',
  },
  {
    word: 'SGN',
    token: 0xb4,
    kind: 'function',
    signature: 'SGN(n)',
    doc: 'Sign of n (-1, 0, 1).',
  },
  {
    word: 'SIN',
    token: 0xb5,
    kind: 'function',
    signature: 'SIN(n)',
    doc: 'Sine (radians).',
  },
  {
    word: 'SQR',
    token: 0xb6,
    kind: 'function',
    signature: 'SQR(n)',
    doc: 'Square root.',
  },
  {
    word: 'TAN',
    token: 0xb7,
    kind: 'function',
    signature: 'TAN(n)',
    doc: 'Tangent (radians).',
  },
  { word: 'TO', token: 0xb8, kind: 'command', doc: 'Loop limit in FOR.' },
  {
    word: 'TRUE',
    token: 0xb9,
    kind: 'function',
    conditional: true,
    doc: 'The constant -1.',
  },
  {
    word: 'USR',
    token: 0xba,
    kind: 'function',
    signature: 'USR(addr)',
    doc: 'Call a machine-code routine, return the result.',
  },
  {
    word: 'VAL',
    token: 0xbb,
    kind: 'function',
    signature: 'VAL(a$)',
    doc: 'Numeric value of a string.',
  },
  {
    word: 'VPOS',
    token: 0xbc,
    kind: 'function',
    conditional: true,
    doc: 'Text cursor row.',
  },
  {
    word: 'CHR$',
    token: 0xbd,
    kind: 'function',
    signature: 'CHR$(n)',
    doc: 'Character with code n.',
  },
  {
    word: 'GET$',
    token: 0xbe,
    kind: 'function',
    doc: 'Wait for a key, return it as a string.',
  },
  {
    word: 'INKEY$',
    token: 0xbf,
    kind: 'function',
    signature: 'INKEY$(t)',
    doc: 'Read a key as a string ("" if none) — game input.',
  },
  {
    word: 'LEFT$(',
    token: 0xc0,
    kind: 'function',
    signature: 'LEFT$(a$,n)',
    doc: 'Leftmost n characters.',
  },
  {
    word: 'MID$(',
    token: 0xc1,
    kind: 'function',
    signature: 'MID$(a$,start[,len])',
    doc: 'Substring.',
  },
  {
    word: 'RIGHT$(',
    token: 0xc2,
    kind: 'function',
    signature: 'RIGHT$(a$,n)',
    doc: 'Rightmost n characters.',
  },
  {
    word: 'STR$',
    token: 0xc3,
    kind: 'function',
    signature: 'STR$(n)',
    doc: 'Number as a string.',
  },
  {
    word: 'STRING$(',
    token: 0xc4,
    kind: 'function',
    signature: 'STRING$(n,a$)',
    doc: 'a$ repeated n times.',
  },
  {
    word: 'EOF',
    token: 0xc5,
    kind: 'function',
    conditional: true,
    signature: 'EOF#chan',
    doc: 'True at end of an open file.',
  },
  {
    word: 'AUTO',
    token: 0xc6,
    kind: 'command',
    lino: true,
    signature: 'AUTO [start[,step]]',
    doc: 'Automatic line numbering (editor command).',
  },
  {
    word: 'DELETE',
    token: 0xc7,
    kind: 'command',
    lino: true,
    signature: 'DELETE start,end',
    doc: 'Delete a range of lines (editor command).',
  },
  {
    word: 'LOAD',
    token: 0xc8,
    kind: 'command',
    signature: 'LOAD "name"',
    doc: 'Load a program from filing system.',
  },
  {
    word: 'LIST',
    token: 0xc9,
    kind: 'command',
    lino: true,
    signature: 'LIST [start,end]',
    doc: 'List the program.',
  },
  {
    word: 'NEW',
    token: 0xca,
    kind: 'command',
    conditional: true,
    doc: 'Erase the current program.',
  },
  {
    word: 'OLD',
    token: 0xcb,
    kind: 'command',
    conditional: true,
    doc: 'Recover a program after NEW.',
  },
  {
    word: 'RENUMBER',
    token: 0xcc,
    kind: 'command',
    lino: true,
    signature: 'RENUMBER [start[,step]]',
    doc: 'Renumber the program.',
  },
  {
    word: 'SAVE',
    token: 0xcd,
    kind: 'command',
    signature: 'SAVE "name"',
    doc: 'Save the program to filing system.',
  },
  {
    word: 'SOUND',
    token: 0xd4,
    kind: 'command',
    signature: 'SOUND chan,amp,pitch,dur',
    doc: 'Make a sound.',
  },
  {
    word: 'BPUT',
    token: 0xd5,
    kind: 'command',
    conditional: true,
    signature: 'BPUT#chan,n',
    doc: 'Write one byte to an open file.',
  },
  {
    word: 'CALL',
    token: 0xd6,
    kind: 'command',
    signature: 'CALL addr[,params]',
    doc: 'Call a machine-code routine.',
  },
  {
    word: 'CHAIN',
    token: 0xd7,
    kind: 'command',
    signature: 'CHAIN "name"',
    doc: 'Load and run another program.',
  },
  {
    word: 'CLEAR',
    token: 0xd8,
    kind: 'command',
    conditional: true,
    doc: 'Clear all variables.',
  },
  {
    word: 'CLOSE',
    token: 0xd9,
    kind: 'command',
    conditional: true,
    signature: 'CLOSE#chan',
    doc: 'Close an open file (CLOSE#0 closes all).',
  },
  {
    word: 'CLG',
    token: 0xda,
    kind: 'command',
    conditional: true,
    doc: 'Clear the graphics screen.',
  },
  {
    word: 'CLS',
    token: 0xdb,
    kind: 'command',
    conditional: true,
    doc: 'Clear the text screen.',
  },
  {
    word: 'DATA',
    token: 0xdc,
    kind: 'command',
    signature: 'DATA item[,item]…',
    doc: 'Inline data for READ.',
  },
  {
    word: 'DEF',
    token: 0xdd,
    kind: 'command',
    signature: 'DEF PROCname / DEF FNname',
    doc: 'Define a procedure or function.',
  },
  {
    word: 'DIM',
    token: 0xde,
    kind: 'command',
    signature: 'DIM a(n[,m])',
    doc: 'Dimension an array (or reserve memory).',
  },
  {
    word: 'DRAW',
    token: 0xdf,
    kind: 'command',
    signature: 'DRAW x,y',
    doc: 'Draw a line to graphics point x,y.',
  },
  {
    word: 'END',
    token: 0xe0,
    kind: 'command',
    conditional: true,
    doc: 'End the program.',
  },
  {
    word: 'ENDPROC',
    token: 0xe1,
    kind: 'command',
    conditional: true,
    doc: 'Return from a procedure.',
  },
  {
    word: 'ENVELOPE',
    token: 0xe2,
    kind: 'command',
    signature: 'ENVELOPE n,…(14 params)',
    doc: 'Define a sound envelope.',
  },
  {
    word: 'FOR',
    token: 0xe3,
    kind: 'command',
    signature: 'FOR v=a TO b [STEP s]',
    doc: 'Start a counted loop.',
  },
  {
    word: 'GOSUB',
    token: 0xe4,
    kind: 'command',
    lino: true,
    signature: 'GOSUB line',
    doc: 'Call a subroutine by line number.',
  },
  {
    word: 'GOTO',
    token: 0xe5,
    kind: 'command',
    lino: true,
    signature: 'GOTO line',
    doc: 'Jump to a line number.',
  },
  {
    word: 'GCOL',
    token: 0xe6,
    kind: 'command',
    signature: 'GCOL mode,colour',
    doc: 'Set the graphics colour and plot mode.',
  },
  {
    word: 'IF',
    token: 0xe7,
    kind: 'command',
    signature: 'IF cond THEN … [ELSE …]',
    doc: 'Conditional execution.',
  },
  {
    word: 'INPUT',
    token: 0xe8,
    kind: 'command',
    signature: 'INPUT ["prompt",] var',
    doc: 'Read a value from the keyboard.',
  },
  {
    word: 'LET',
    token: 0xe9,
    kind: 'command',
    signature: 'LET v=expr',
    doc: 'Assignment (LET is optional in BBC BASIC).',
  },
  {
    word: 'LOCAL',
    token: 0xea,
    kind: 'command',
    signature: 'LOCAL v[,v]…',
    doc: 'Declare PROC/FN-local variables.',
  },
  {
    word: 'MODE',
    token: 0xeb,
    kind: 'command',
    signature: 'MODE n',
    doc: 'Select screen mode 0–7 (7 = teletext).',
  },
  {
    word: 'MOVE',
    token: 0xec,
    kind: 'command',
    signature: 'MOVE x,y',
    doc: 'Move the graphics cursor.',
  },
  {
    word: 'NEXT',
    token: 0xed,
    kind: 'command',
    signature: 'NEXT [v]',
    doc: 'End of a FOR loop.',
  },
  {
    word: 'ON',
    token: 0xee,
    kind: 'command',
    signature: 'ON n GOTO/GOSUB …',
    doc: 'Computed jump (also ON ERROR).',
  },
  {
    word: 'VDU',
    token: 0xef,
    kind: 'command',
    signature: 'VDU n[,n]…',
    doc: 'Send bytes to the VDU driver.',
  },
  {
    word: 'PLOT',
    token: 0xf0,
    kind: 'command',
    signature: 'PLOT k,x,y',
    doc: 'General graphics plot.',
  },
  {
    word: 'PRINT',
    token: 0xf1,
    kind: 'command',
    signature: "PRINT [TAB(x,y)][expr][;,']",
    doc: 'Print to the screen.',
  },
  {
    word: 'PROC',
    token: 0xf2,
    kind: 'command',
    signature: 'PROCname[(args)]',
    doc: 'Call a named procedure.',
  },
  {
    word: 'READ',
    token: 0xf3,
    kind: 'command',
    signature: 'READ var[,var]…',
    doc: 'Read the next DATA item.',
  },
  {
    word: 'REM',
    token: 0xf4,
    kind: 'command',
    signature: 'REM comment',
    doc: 'Comment line.',
  },
  {
    word: 'REPEAT',
    token: 0xf5,
    kind: 'command',
    doc: 'Start a REPEAT…UNTIL loop.',
  },
  {
    word: 'REPORT',
    token: 0xf6,
    kind: 'command',
    conditional: true,
    doc: 'Print the last error message.',
  },
  {
    word: 'RESTORE',
    token: 0xf7,
    kind: 'command',
    lino: true,
    signature: 'RESTORE [line]',
    doc: 'Reset the DATA pointer.',
  },
  {
    word: 'RETURN',
    token: 0xf8,
    kind: 'command',
    conditional: true,
    doc: 'Return from a GOSUB.',
  },
  {
    word: 'RUN',
    token: 0xf9,
    kind: 'command',
    conditional: true,
    doc: 'Run the program.',
  },
  {
    word: 'STOP',
    token: 0xfa,
    kind: 'command',
    conditional: true,
    doc: 'Stop with an error report.',
  },
  {
    word: 'COLOUR',
    token: 0xfb,
    kind: 'command',
    signature: 'COLOUR n',
    doc: 'Set the text colour (+128 sets background).',
  },
  {
    word: 'TRACE',
    token: 0xfc,
    kind: 'command',
    lino: true,
    signature: 'TRACE [ON|OFF|line]',
    doc: 'Trace line numbers as they execute.',
  },
  {
    word: 'UNTIL',
    token: 0xfd,
    kind: 'command',
    signature: 'UNTIL cond',
    doc: 'End of a REPEAT loop.',
  },
  {
    word: 'WIDTH',
    token: 0xfe,
    kind: 'command',
    signature: 'WIDTH n',
    doc: 'Set the print field width.',
  },
  {
    word: 'OSCLI',
    token: 0xff,
    kind: 'command',
    signature: 'OSCLI a$',
    doc: 'Pass a$ to the command-line interpreter.',
  },
];

/** Strip the trailing '(' that print formatters/string functions carry. */
function displayWord(word: string): string {
  return word.endsWith('(') ? word.slice(0, -1) : word;
}

/**
 * Editor-facing keyword list (highlighting + autocomplete). Same data as
 * {@link bbcKeywordTable} with the trailing '(' removed from the display word.
 */
export const bbcKeywords: KeywordInfo[] = bbcKeywordTable.map((k) => ({
  word: displayWord(k.word),
  token: k.token,
  kind: k.kind,
  ...(k.signature ? { signature: k.signature } : {}),
  ...(k.doc ? { doc: k.doc } : {}),
}));

/** Keywords sorted longest spelling first, for greedy matching. */
export const bbcKeywordsByLength: BbcKeyword[] = [...bbcKeywordTable].sort(
  (a, b) => b.word.length - a.word.length,
);

/** token byte (function form and statement form) -> canonical spelling. */
export const bbcWordByToken = new Map<number, string>();
for (const k of bbcKeywordTable) {
  bbcWordByToken.set(k.token, k.word);
  if (k.statementToken !== undefined)
    bbcWordByToken.set(k.statementToken, k.word);
}
