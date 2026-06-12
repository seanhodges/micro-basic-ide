export const SCREEN_WIDTH = 256;
export const SCREEN_HEIGHT = 192;

/**
 * Largest integer multiplier that fits the machine display inside the
 * available space. Never below 1 so the screen stays visible on tiny
 * viewports. Defaults to the classic 256×192 Sinclair display.
 */
export function computeIntegerScale(
  availWidth: number,
  availHeight: number,
  screenWidth: number = SCREEN_WIDTH,
  screenHeight: number = SCREEN_HEIGHT,
): number {
  return Math.max(
    1,
    Math.floor(Math.min(availWidth / screenWidth, availHeight / screenHeight)),
  );
}
