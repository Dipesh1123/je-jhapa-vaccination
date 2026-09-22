// Loads data/reference.json once and re-exports it plus a couple of lookup
// maps every vaccination.js helper needs. Population/JE-target figures live
// here, not in the Sheet - see vaccination.js for why.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REFERENCE_PATH = path.join(__dirname, "..", "..", "data", "reference.json");

export const REFERENCE = JSON.parse(readFileSync(REFERENCE_PATH, "utf-8"));
export const LOCAL_LEVELS = REFERENCE.local_levels;

export const LOCAL_LEVEL_BY_CODE = Object.fromEntries(LOCAL_LEVELS.map((l) => [l.code, l]));

/** ward_code -> { localLevel, ward } */
export const WARD_BY_CODE = Object.fromEntries(
  LOCAL_LEVELS.flatMap((localLevel) => localLevel.wards.map((ward) => [ward.code, { localLevel, ward }]))
);
