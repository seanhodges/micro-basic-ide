import { useEffect, useRef } from 'react';
import { EditorState, Prec } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
} from '@codemirror/view';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands';
import {
  autocompletion,
  completionKeymap,
  completionStatus,
} from '@codemirror/autocomplete';
import { lintGutter, lintKeymap } from '@codemirror/lint';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import {
  syntaxHighlighting,
  defaultHighlightStyle,
} from '@codemirror/language';
import type { Dialect } from '../dialects/types';
import { dialectLinter } from '../editor/lintIntegration';
import { useIdeStore } from '../app/store';
import {
  insertNumberedLineBelow,
  parseLines,
  renumberLine,
  MIN_LINE_NO,
  MAX_LINE_NO,
} from '../editor/lineNumbering';

/** Replace the whole document and drop the cursor at the end of `cursorLine`. */
function replaceDoc(
  view: EditorView,
  lines: string[],
  cursorLine: number,
): void {
  const text = lines.join('\n');
  const anchor = lines.slice(0, cursorLine + 1).join('\n').length;
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text },
    selection: { anchor },
    scrollIntoView: true,
  });
}

/** Enter handler: auto-prefix a line number on the new line (and bootstrap the current one). */
function autoNumberOnEnter(view: EditorView): boolean {
  const { autoLineNumbering, lineNumberIncrement } = useIdeStore.getState();
  if (!autoLineNumbering) return false;
  const { state } = view;
  // Let an open autocomplete popup consume Enter (accept completion) first.
  if (completionStatus(state) === 'active') return false;
  const sel = state.selection.main;
  if (!sel.empty) return false;
  const line = state.doc.lineAt(sel.head);
  if (sel.head !== line.to) return false; // only at end of line — else split normally

  const physical = state.doc.toString().split('\n');
  const result = insertNumberedLineBelow(
    physical,
    line.number - 1,
    lineNumberIncrement,
  );
  if (!result) return false; // nothing to number — fall back to default newline
  replaceDoc(view, result.lines, result.cursorLine);
  return true;
}

/** Renumber the line under the cursor, prompting for the new number and fixing references. */
function renumberCurrentLine(view: EditorView): boolean {
  const { state } = view;
  const line = state.doc.lineAt(state.selection.main.head);
  const m = /^\s*(\d+)\s?/.exec(line.text);
  if (!m) return false; // no line number here
  const oldNo = parseInt(m[1]!, 10);

  const input = window.prompt(`Renumber line ${oldNo} to:`, String(oldNo));
  if (input === null) return true; // cancelled — but the key was ours
  const newNo = parseInt(input.trim(), 10);
  if (!Number.isInteger(newNo) || newNo < MIN_LINE_NO || newNo > MAX_LINE_NO) {
    window.alert(
      `Line number must be an integer between ${MIN_LINE_NO} and ${MAX_LINE_NO}.`,
    );
    return true;
  }
  if (newNo === oldNo) return true;
  const docText = state.doc.toString();
  if (parseLines(docText).some((l) => l.lineNo === newNo)) {
    window.alert(`Line ${newNo} already exists.`);
    return true;
  }

  const newLines = renumberLine(docText, oldNo, newNo).split('\n');
  const ci = newLines.findIndex((l) =>
    new RegExp(`^\\s*${newNo}(\\s|$)`).test(l),
  );
  replaceDoc(view, newLines, ci < 0 ? newLines.length - 1 : ci);
  view.focus();
  return true;
}

interface Props {
  dialect: Dialect;
  /** Pushed into the editor whenever seq changes. */
  override: { text: string; seq: number };
  onChange(text: string): void;
}

export function CodeMirrorHost({ dialect, override, onChange }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const lastSeq = useRef(-1);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const renumberRequest = useIdeStore((s) => s.renumberRequest);
  const lastRenumber = useRef(renumberRequest);

  useEffect(() => {
    if (!hostRef.current) return;
    const state = EditorState.create({
      doc: override.text,
      extensions: [
        Prec.highest(
          keymap.of([
            { key: 'Enter', run: autoNumberOnEnter },
            { key: 'Mod-Alt-r', run: renumberCurrentLine },
          ]),
        ),
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        drawSelection(),
        history(),
        autocompletion({ activateOnTyping: true }),
        highlightSelectionMatches(),
        syntaxHighlighting(defaultHighlightStyle),
        dialect.languageSupport(),
        dialectLinter(dialect),
        lintGutter(),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...completionKeymap,
          ...searchKeymap,
          ...lintKeymap,
          indentWithTab,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged)
            onChangeRef.current(update.state.doc.toString());
        }),
        EditorView.theme({
          '&': { height: '100%', fontSize: '14px' },
          '.cm-scroller': {
            fontFamily: "'IBM Plex Mono', 'Fira Mono', monospace",
          },
        }),
      ],
    });
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    lastSeq.current = override.seq;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // The editor is rebuilt only when the dialect changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialect]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || override.seq === lastSeq.current) return;
    lastSeq.current = override.seq;
    if (view.state.doc.toString() !== override.text) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: override.text },
      });
    }
  }, [override]);

  // Toolbar "Renumber line" button bumps renumberRequest; run the command here
  // where we hold the EditorView.
  useEffect(() => {
    if (renumberRequest === lastRenumber.current) return;
    lastRenumber.current = renumberRequest;
    const view = viewRef.current;
    if (view) renumberCurrentLine(view);
  }, [renumberRequest]);

  return <div className="cm-host" ref={hostRef} />;
}
