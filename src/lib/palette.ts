// Validated against our actual chart surface (#f8fafc light / #1a1a19 dark)
// with the dataviz skill's validate_palette.js - not eyeballed.
//   node validate_palette.js "<8 hex>" --surface "#f8fafc" --mode light
//   node validate_palette.js "<8 hex>" --surface "#1a1a19" --mode dark
// Light: ALL CHECKS PASS (WARN on 3 slots below 3:1 contrast - the documented
//   "relief rule" applies: those series always carry a visible direct label
//   or sit in a table view, never color alone).
// Dark: ALL CHECKS PASS outright, all 8 slots clear 3:1.
//
// Do not reorder these arrays - the slot ORDER is the CVD-safety mechanism
// (validated adjacent-pair by adjacent-pair), not a cosmetic choice.

export const categorical = {
  light: [
    "#2a78d6", // 1 blue
    "#eb6834", // 2 orange
    "#1baf7a", // 3 aqua  (WARN: 2.69:1 - needs direct label)
    "#eda100", // 4 yellow (WARN: 2.07:1 - needs direct label)
    "#e87ba4", // 5 magenta (WARN: 2.57:1 - needs direct label)
    "#008300", // 6 green
    "#4a3aa7", // 7 violet
    "#e34948", // 8 red
  ],
  dark: [
    "#3987e5",
    "#d95926",
    "#199e70",
    "#c98500",
    "#d55181",
    "#008300",
    "#9085e9",
    "#e66767",
  ],
} as const;

// Age x sex breakdown uses exactly these 4, in this order - fixed regardless
// of which bar is largest, so filtering/sorting never repaints identity.
export const ageSexSeries = {
  v_30_60_f: { light: categorical.light[0], dark: categorical.dark[0], labelNe: "३०-६० वर्ष, महिला" },
  v_30_60_m: { light: categorical.light[1], dark: categorical.dark[1], labelNe: "३०-६० वर्ष, पुरुष" },
  v_60plus_f: { light: categorical.light[2], dark: categorical.dark[2], labelNe: "६०+ वर्ष, महिला" },
  v_60plus_m: { light: categorical.light[3], dark: categorical.dark[3], labelNe: "६०+ वर्ष, पुरुष" },
} as const;

// Coverage-trend line: actual vs the pace needed to hit 100% by campaign end.
export const trendSeries = {
  actual: { light: categorical.light[0], dark: categorical.dark[0], labelNe: "वास्तविक प्रगति" },
  pace: { light: categorical.light[1], dark: categorical.dark[1], labelNe: "आवश्यक गति" },
} as const;

// Sequential (blue, light->dark) - for the choropleth and any magnitude-only
// bar (e.g. the palika league table, which encodes coverage %, not identity).
// Continuous ramp; not run through the categorical validator - the applicable
// check for a sequential ramp is lightness monotonicity, which this is by
// construction (each step is a darker stop of one hue).
export const sequentialBlue = {
  100: "#cde2fb", 150: "#b7d3f6", 200: "#9ec5f4", 250: "#86b6ef",
  300: "#6da7ec", 350: "#5598e7", 400: "#3987e5", 450: "#2a78d6",
  500: "#256abf", 550: "#1c5cab", 600: "#184f95", 650: "#104281",
  700: "#0d366b",
} as const;

// Status palette - fixed, never themed, never reused as a series color.
// Always paired with an icon + label; on the light surface "warning" and
// "serious" are sub-3:1 by design, so color never carries meaning alone.
export const status = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;

// Chart chrome & ink
export const ink = {
  light: {
    surface: "#f8fafc", // our actual app surface, not the skill's #fcfcfb default
    primary: "#1e293b", // our actual app ink (slate-800), not the skill's #0b0b0b
    secondary: "#52514e",
    muted: "#898781",
    gridline: "#e1e0d9",
    baseline: "#c3c2b7",
  },
  dark: {
    surface: "#1a1a19",
    primary: "#ffffff",
    secondary: "#c3c2b7",
    muted: "#898781",
    gridline: "#2c2c2a",
    baseline: "#383835",
  },
} as const;
