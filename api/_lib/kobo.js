// Maps a raw KoBo submission (flat "group/field": value JSON) onto the
// BigQuery `reports` row shape.
//
// KoBo's v2 JSON export keys every field as "group1/group2/field_name" -
// never a nested object, since this form has no repeat groups. Every leaf
// field name in je_daily_facility_report.xlsx is unique across the whole
// form (vaccine_opening, diluent_opening, ... never bare "opening"), so
// mapping by the trailing path segment is robust even if groups are
// renamed or re-nested later.

const INT_FIELDS = [
  "v_30_60_f", "v_30_60_m", "v_60plus_f", "v_60plus_m", "total_doses",
  "vaccine_opening", "vaccine_received", "vaccine_used", "vaccine_closing",
  "diluent_opening", "diluent_received", "diluent_used", "diluent_closing",
  "ad_syr_opening", "ad_syr_received", "ad_syr_used", "ad_syr_closing",
  "recon_syr_opening", "recon_syr_received", "recon_syr_used", "recon_syr_closing",
  "safety_box_opening", "safety_box_received", "safety_box_used", "safety_box_closing",
  "vials_discarded", "doses_available", "doses_per_vial", "aefi_minor", "aefi_serious",
];
const FLOAT_FIELDS = ["wastage_rate"];
const STRING_FIELDS = [
  "facility_name",
  "reporter_name", "reporter_designation", "reporter_phone",
  "aefi_remarks", "remarks",
];

function lastSegment(path) {
  const parts = path.split("/");
  return parts[parts.length - 1];
}

function toInt(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function toFloat(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/** local_level/ward select_one values are choice *names* like
 *  "mechinagar_municipality" / "mechinagar_municipality_7" - already the
 *  codes ref_local_level.code / ref_ward.code use, by construction in
 *  build_xlsform.py's slug(). No further lookup needed. */
export function mapSubmission(raw) {
  const flat = {};
  for (const [path, value] of Object.entries(raw)) {
    flat[lastSegment(path)] = value;
  }

  const geopoint = flat.facility_gps || ""; // "lat lon alt acc"
  const [latStr, lonStr] = geopoint.trim().split(/\s+/);

  const row = {
    submission_uuid: raw._uuid || raw["formhub/uuid"] || flat.instanceID,
    submitted_at: raw._submission_time ? new Date(raw._submission_time).toISOString() : null,
    ingested_at: new Date().toISOString(),

    report_date_ad: flat.report_date_ad || null,

    local_level_code: flat.local_level || null,
    ward_code: flat.ward_no || null,
    ward_no: flat.ward_no ? toInt(flat.ward_no.split("_").pop()) : null,
    facility_name: flat.facility_name || null,
    facility_lat: toFloat(latStr),
    facility_lon: toFloat(lonStr),

    reporter_name: flat.reporter_name || null,
    reporter_designation: flat.reporter_designation || null,
    reporter_phone: flat.reporter_phone || null,

    aefi_remarks: flat.aefi_remarks || null,
    remarks: flat.remarks || null,
  };

  for (const f of INT_FIELDS) row[f] = toInt(flat[f]);
  for (const f of FLOAT_FIELDS) row[f] = toFloat(flat[f]);

  // total_doses is a `calculate` in the form and should always be present,
  // but derive it defensively in case a client ever fails to evaluate it.
  if (row.total_doses === null) {
    row.total_doses = (row.v_30_60_f || 0) + (row.v_30_60_m || 0)
      + (row.v_60plus_f || 0) + (row.v_60plus_m || 0);
  }

  if (!row.submission_uuid) {
    throw new Error("submission has no _uuid - cannot deduplicate, refusing to insert");
  }
  if (!row.local_level_code || !row.ward_code) {
    throw new Error(`submission ${row.submission_uuid} missing local_level/ward_no`);
  }

  return row;
}
