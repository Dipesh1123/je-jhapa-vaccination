// Single Google Sheets client factory - every api/ route that needs the
// campaign data reads through fetchAllPalikaTabs(), never calls the Sheets
// API directly. Reuses the same service-account key that used to authenticate
// BigQuery (GCP_SERVICE_ACCOUNT_B64) - it just needs Sheets read scope and
// Viewer access on the spreadsheet, no new credential to mint.

import { google } from "googleapis";
import { LOCAL_LEVELS } from "./reference.js";

let sheetsClient;

function credentials() {
  const b64 = process.env.GCP_SERVICE_ACCOUNT_B64;
  if (!b64) throw new Error("GCP_SERVICE_ACCOUNT_B64 is not set");
  return JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
}

function getSheetsClient() {
  if (sheetsClient) return sheetsClient;
  const auth = new google.auth.GoogleAuth({
    credentials: credentials(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

export const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID;

function quoteTabName(name) {
  return `'${name.replace(/'/g, "''")}'`;
}

// Generous fixed range per tab - cheap to over-request, and avoids needing to
// know each palika's exact row count (varies with ward count).
const TAB_RANGE = "A1:I300";

let cache = null; // { data, expiresAt }
let inFlight = null;

/** Every palika tab's raw 2D values, keyed by local_level_code. One batched
 *  HTTP call covers all 15 tabs. Cached in-process for 60s (+ in-flight
 *  de-dupe) so concurrent cache-misses across this app's ~150 distinct edge
 *  cache keys collapse into a single upstream call per warm container. */
export async function fetchAllPalikaTabs() {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.data;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    if (!SPREADSHEET_ID) throw new Error("SHEETS_SPREADSHEET_ID is not set");
    const sheets = getSheetsClient();
    const ranges = LOCAL_LEVELS.map((l) => `${quoteTabName(l.name)}!${TAB_RANGE}`);
    const res = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges,
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const byCode = {};
    LOCAL_LEVELS.forEach((l, i) => {
      byCode[l.code] = res.data.valueRanges[i].values || [];
    });

    cache = { data: byCode, expiresAt: Date.now() + 60_000 };
    inFlight = null;
    return byCode;
  })();

  try {
    return await inFlight;
  } catch (err) {
    inFlight = null;
    throw err;
  }
}
