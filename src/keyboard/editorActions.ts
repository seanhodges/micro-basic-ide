import type { EditorKeyAction, KeyDef, KeyboardLayout } from './layoutSchema';

/**
 * Resolve what a key does when the keyboard targets the text editor, on the
 * given layer. Pure data lookup — all machine specifics live in the layout.
 *
 * Resolution order:
 *  1. modifier keys never produce editor actions (the engine handles them);
 *  2. an explicit KeyLabel.editor wins (null = forced no-op);
 *  3. a text label on a layer with editorInsertStyle derives an insert
 *     ('char' = verbatim, 'word' = text + trailing space);
 *  4. glyph-only labels have no default — glyph inserts must be explicit;
 *  5. otherwise fall back to the base layer (so digits, SPACE, NEW LINE…
 *     keep working in keyword/function/graphics modes, like the real ZX81).
 */
export function resolveEditorAction(
  layout: KeyboardLayout,
  key: KeyDef,
  layerId: string,
): EditorKeyAction | null {
  if (key.modifier) return null;
  const baseLayer =
    layout.layers.find((l) => l.activeWhen.length === 0) ?? layout.layers[0];
  const resolved = resolveOnLayer(layout, key, layerId);
  if (resolved !== undefined) return resolved;
  if (baseLayer && baseLayer.id !== layerId) {
    const fallback = resolveOnLayer(layout, key, baseLayer.id);
    if (fallback !== undefined) return fallback;
  }
  return null;
}

/** undefined = nothing usable on this layer (caller may fall back). */
function resolveOnLayer(
  layout: KeyboardLayout,
  key: KeyDef,
  layerId: string,
): EditorKeyAction | null | undefined {
  const layerIdx = layout.layers.findIndex((l) => l.id === layerId);
  if (layerIdx < 0) return undefined;
  const label = key.labels[layerIdx];
  if (!label) return undefined;
  if (label.editor !== undefined) return label.editor;
  const style = layout.layers[layerIdx]!.editorInsertStyle;
  if (label.text !== undefined && style !== undefined) {
    return { insert: style === 'word' ? `${label.text} ` : label.text };
  }
  return undefined;
}

/** Actions that auto-repeat while the key is held (editor target only). */
export function isRepeatable(action: EditorKeyAction): boolean {
  return 'action' in action && action.action !== 'newline';
}
