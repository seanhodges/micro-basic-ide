import type {
  Completion,
  CompletionContext,
  CompletionResult,
  CompletionSource,
} from '@codemirror/autocomplete';
import type { KeywordInfo } from '../dialects/types';

/** Build an autocomplete source from a dialect's keyword table. */
export function buildCompletionSource(
  keywords: KeywordInfo[],
): CompletionSource {
  const options: Completion[] = keywords
    .filter((k) => /^[A-Z]/.test(k.word))
    .map((k) => ({
      label: k.word,
      type:
        k.kind === 'command'
          ? 'keyword'
          : k.kind === 'function'
            ? 'function'
            : 'operator',
      detail: k.signature,
      info: k.doc,
      boost: k.kind === 'command' ? 1 : 0,
    }));

  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/[A-Za-z][A-Za-z$]*/);
    if (!word && !context.explicit) return null;
    // Don't complete inside strings (odd number of quotes before cursor)
    const line = context.state.doc.lineAt(context.pos);
    const before = context.state.sliceDoc(line.from, context.pos);
    const quotes = (before.match(/"/g) ?? []).length;
    if (quotes % 2 === 1) return null;

    return {
      from: word ? word.from : context.pos,
      options,
      validFor: /^[A-Za-z$]*$/,
    };
  };
}
