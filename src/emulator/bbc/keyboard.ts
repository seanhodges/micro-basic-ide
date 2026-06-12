import * as utils from 'jsbeeb/src/utils.js';
import type { SysVia } from 'jsbeeb/src/fake6502.js';

/**
 * Virtual-keyboard tokens → BBC key matrix positions.
 *
 * Tokens follow the DOM-code-style convention the other dialects use
 * ('KeyA', 'Digit1', 'Enter'…) plus BBC-specific keys (Copy, ShiftLock,
 * F0–F9). 'Break' is intentionally absent: it is the CPU reset line, not a
 * matrix key, and is handled by BbcMachine.setKey directly.
 */
const TOKEN_TO_MATRIX: Record<string, readonly [number, number]> = (() => {
  const B = utils.BBC;
  const map: Record<string, readonly [number, number]> = {
    Enter: B.RETURN!,
    Shift: B.SHIFT!,
    Ctrl: B.CTRL!,
    Space: B.SPACE!,
    Escape: B.ESCAPE!,
    Tab: B.TAB!,
    CapsLock: B.CAPSLOCK!,
    ShiftLock: B.SHIFTLOCK!,
    Delete: B.DELETE!,
    Copy: B.COPY!,
    ArrowLeft: B.LEFT!,
    ArrowRight: B.RIGHT!,
    ArrowUp: B.UP!,
    ArrowDown: B.DOWN!,
    Minus: B.MINUS!,
    Caret: B.HAT_TILDE!,
    Backslash: B.PIPE_BACKSLASH!,
    At: B.AT!,
    BracketLeft: B.LEFT_SQUARE_BRACKET!,
    BracketRight: B.RIGHT_SQUARE_BRACKET!,
    Underscore: B.UNDERSCORE_POUND!,
    Semicolon: B.SEMICOLON_PLUS!,
    Colon: B.COLON_STAR!,
    Comma: B.COMMA!,
    Period: B.PERIOD!,
    Slash: B.SLASH!,
  };
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i);
    map[`Key${letter}`] = B[letter]!;
  }
  for (let d = 0; d <= 9; d++) {
    map[`Digit${d}`] = B[`K${d}`]!;
    map[`F${d}`] = B[`F${d}`]!;
  }
  return map;
})();

export function matrixForToken(
  token: string,
): readonly [number, number] | undefined {
  return TOKEN_TO_MATRIX[token];
}

/**
 * Host keyboard → jsbeeb. jsbeeb's SysVia natural-layout key map is indexed
 * by legacy JS keyCodes, with synthetic codes distinguishing left/right
 * modifiers via KeyboardEvent.location (keyup reports location 0 in Chrome,
 * so the last seen down-location is remembered — same scheme as jsbeeb's own
 * Keyboard class and the Owlet editor).
 */
export class BbcHostKeyboard {
  private lastShiftLocation = 1;
  private lastCtrlLocation = 1;
  private lastAltLocation = 1;

  constructor(private readonly sysvia: SysVia) {
    sysvia.setKeyLayout('natural');
  }

  /** Returns true when the event mapped to a BBC key and was consumed. */
  handleKey(e: KeyboardEvent, down: boolean): boolean {
    const code = this.resolveKeyCode(e);
    if (code === 0) return false;
    if (down) this.sysvia.keyDown(code, e.shiftKey);
    else this.sysvia.keyUp(code);
    return true;
  }

  private resolveKeyCode(e: KeyboardEvent): number {
    const kc = utils.keyCodes;
    const raw = e.which || e.keyCode;
    switch (e.location) {
      case 1:
        if (raw === kc.SHIFT) {
          this.lastShiftLocation = 1;
          return kc.SHIFT_LEFT!;
        }
        if (raw === kc.CTRL) {
          this.lastCtrlLocation = 1;
          return kc.CTRL_LEFT!;
        }
        if (raw === kc.ALT) {
          this.lastAltLocation = 1;
          return kc.ALT_LEFT!;
        }
        break;
      case 2:
        if (raw === kc.SHIFT) {
          this.lastShiftLocation = 2;
          return kc.SHIFT_RIGHT!;
        }
        if (raw === kc.CTRL) {
          this.lastCtrlLocation = 2;
          return kc.CTRL_RIGHT!;
        }
        if (raw === kc.ALT) {
          this.lastAltLocation = 2;
          return kc.ALT_RIGHT!;
        }
        break;
      case 3:
        if (raw === kc.ENTER) return kc.NUMPADENTER!;
        break;
      default:
        // keyup events report location 0; reuse the last seen down-location.
        if (raw === kc.SHIFT)
          return this.lastShiftLocation === 1
            ? kc.SHIFT_LEFT!
            : kc.SHIFT_RIGHT!;
        if (raw === kc.CTRL)
          return this.lastCtrlLocation === 1 ? kc.CTRL_LEFT! : kc.CTRL_RIGHT!;
        if (raw === kc.ALT)
          return this.lastAltLocation === 1 ? kc.ALT_LEFT! : kc.ALT_RIGHT!;
        break;
    }
    return raw;
  }
}
