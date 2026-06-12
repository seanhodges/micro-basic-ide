import { StreamLanguage, LanguageSupport } from '@codemirror/language';
import type { CompletionSource } from '@codemirror/autocomplete';
import type { KeywordInfo } from '../dialects/types';

interface BasicStreamState {
  afterRem: boolean;
}

/**
 * Build a CodeMirror LanguageSupport for a line-numbered BASIC dialect from
 * its keyword table. Dialect-scoped data (autocomplete) rides on
 * languageData so several dialects can coexist.
 */
export function buildBasicLanguage(
  keywords: KeywordInfo[],
  completionSource: CompletionSource,
): LanguageSupport {
  const words = new Set(
    keywords.map((k) => k.word).filter((w) => /^[A-Z]/.test(w)),
  );
  const maxWordLen = Math.max(...[...words].map((w) => w.length));

  const language = StreamLanguage.define<BasicStreamState>({
    name: 'basic',
    startState: () => ({ afterRem: false }),
    token(stream, state) {
      if (stream.sol()) {
        state.afterRem = false;
        if (stream.match(/^\s*\d+/)) return 'labelName';
      }
      if (state.afterRem) {
        stream.skipToEnd();
        return 'comment';
      }
      if (stream.eatSpace()) return null;

      if (stream.match('"')) {
        while (!stream.eol()) {
          if (stream.match('""')) continue;
          if (stream.match('"')) return 'string';
          stream.next();
        }
        return 'string';
      }

      const word = stream.match(/^[A-Za-z][A-Za-z$]*/, false);
      if (word) {
        const text = (word as RegExpMatchArray)[0].toUpperCase();
        // Longest keyword prefix of this identifier-run
        for (let len = Math.min(text.length, maxWordLen); len >= 2; len--) {
          const candidate = text.slice(0, len);
          if (!words.has(candidate)) continue;
          // keyword must consume the whole identifier-run unless it ends in $
          if (len === text.length || candidate.endsWith('$')) {
            for (let i = 0; i < len; i++) stream.next();
            if (candidate === 'REM') {
              state.afterRem = true;
              return 'keyword';
            }
            return 'keyword';
          }
        }
        stream.match(/^[A-Za-z][A-Za-z0-9$]*/);
        return 'variableName';
      }

      if (stream.match(/^\d+(\.\d*)?(E[+-]?\d+)?/i)) return 'number';
      if (stream.match(/^(\*\*|<=|>=|<>)/)) return 'operator';
      if (stream.match(/^[%\\]../)) return 'atom'; // graphics escape / inverse
      if (stream.match(/^[+\-*/=<>;,():?$£.]/)) return 'operator';
      stream.next();
      return null;
    },
    languageData: {
      commentTokens: { line: 'REM ' },
    },
  });

  return new LanguageSupport(language, [
    language.data.of({ autocomplete: completionSource }),
  ]);
}
