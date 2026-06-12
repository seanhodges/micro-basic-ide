export const SCREEN_WIDTH = 256;
export const SCREEN_HEIGHT = 192;

/**
 * Largest integer multiplier that fits the 256×192 machine display inside the
 * available space. Never below 1 so the screen stays visible on tiny viewports.
 */
export function computeIntegerScale(
  availWidth: number,
  availHeight: number,
): number {
  return Math.max(
    1,
    Math.floor(
      Math.min(availWidth / SCREEN_WIDTH, availHeight / SCREEN_HEIGHT),
    ),
  );
}
