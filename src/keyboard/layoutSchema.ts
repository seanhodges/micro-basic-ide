/**
 * Data schema for machine-specific virtual keyboard layouts.
 *
 * A dialect pack describes its keyboard entirely as data conforming to these
 * types; the VirtualKeyboard component and input engine contain no
 * machine-specific logic. Adding a new machine (C64, BBC…) means adding a
 * layout object, never keyboard code.
 */

export interface KeyboardLayout {
  id: string;
  name: string;
  /** CSS class applied to the keyboard container, e.g. "vk-theme-zx81". */
  theme: string;
  /** Fine-grained grid columns per row (e.g. 40 for 10 uniform keys × 4). */
  gridColumns: number;
  layers: LayerDef[];
  modifiers: ModifierDef[];
  rows: KeyDef[][];
  glyphs: GlyphRegistry;
  options?: {
    /** Minimum emulated frames a matrix press is held so the ROM scan sees it. */
    minHoldFrames?: number;
    /**
     * Layer shown alongside the base layer when the keyboard is too narrow
     * to render every legend (compact mode). Defaults to the first non-base
     * layer.
     */
    compactDefaultLayer?: string;
  };
}

export interface LayerDef {
  id: string;
  /** Display name in the compact-mode legend selector (defaults to id). */
  name?: string;
  /** Where this layer's label sits on/around the keycap. */
  position: 'center' | 'tl' | 'tr' | 'bl' | 'br' | 'below';
  /** Modifier ids that make this the active layer; [] = base layer. */
  activeWhen: string[];
}

export interface KeyDef {
  id: string;
  /** Width in grid columns. */
  spanX: number;
  /** Visual+logical grouping for split/L-shaped keys (rendering deferred). */
  pressGroup?: string;
  /** Machine key tokens pressed/released together for this key. */
  emits: string[];
  /** Index-aligned with layout.layers; null = no label on that layer. */
  labels: (KeyLabel | null)[];
  /** When set, this key IS the named modifier (see layout.modifiers). */
  modifier?: string;
  /** Extra CSS class suffix for per-key styling. */
  style?: string;
}

export interface KeyLabel {
  text?: string;
  /** Name of a glyph in the layout's glyph registry. */
  glyph?: string;
}

export interface ModifierDef {
  id: string;
  /** Machine tokens held while the modifier is engaged ([] = UI-only). */
  emits: string[];
  /** Tap engages it for the next non-modifier key. */
  sticky: boolean;
  /** Double-tap locks it until tapped again. */
  lockable: boolean;
}

/**
 * Glyphs are constrained path data rendered into <svg><path/></svg> — never
 * innerHTML of arbitrary SVG strings, so community layouts can't inject
 * markup. Paths default to fill: currentColor to inherit theme colours.
 */
export interface GlyphRegistry {
  [name: string]: { viewBox: string; paths: { d: string; fill?: string }[] };
}
