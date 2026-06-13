/**
 * ZX Spectrum system variable addresses (48K BASIC). Only the handful the
 * variable watcher needs are defined here.
 */

/** VARS: 16-bit LE pointer to the start of the BASIC variables area. */
export const VARS = 0x5c4b;
/** E_LINE: 16-bit LE pointer just past the variables area (upper bound). */
export const E_LINE = 0x5c59;
