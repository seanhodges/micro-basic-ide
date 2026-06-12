import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import { buildBasicLanguage } from '../../editor/basicLanguage';
import { buildCompletionSource } from '../../editor/completions';
import { bbcKeywords } from './keywords';

export const bbcCompletionSource: CompletionSource =
  buildCompletionSource(bbcKeywords);

export function bbcLanguageSupport(): Extension {
  return buildBasicLanguage(bbcKeywords, bbcCompletionSource);
}
