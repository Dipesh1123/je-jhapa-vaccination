-- JE Vaccination daily reporting - BigQuery schema
-- Dataset: je_jhapa   Region: asia-south1
--
-- Apply with:
--   bq --location=asia-south1 mk --dataset "$GCP_PROJECT:je_jhapa"
--   bq query --use_legacy_sql=false --project_id="$GCP_PROJECT" < scripts/bq_schema.sql
--
-- Every aggregation the dashboard needs lives here as a view, so the front end
-- ships no roll-up logic and coverage % is computed one way in one place.

-- ---------------------------------------------------------------- reference data
-- Seeded from JE-083_84.xlsx via scripts/seed_bigquery.py. These carry the
-- campaign denominators, so nothing here is ever derived from submissions.

CREATE TABLE IF NOT EXISTS je_jhapa.ref_local_level (
  code        STRING  NOT NULL,   -- mechinagar_municipality
  name        STRING  NOT NULL,   -- Mechinagar Municipality
  population  INT64   NOT NULL,
  je_target   NUMERIC NOT NULL,   -- 48% of population, exact microplan figure
  ward_count  INT64   NOT NULL
);

CREATE TABLE IF NOT EXISTS je_jhapa.ref_ward (
  code              STRING  NOT NULL,   -- mechinagar_municipality_7
  local_level_code  STRING  NOT NULL,
  ward_no           INT64   NOT NULL,
  population        INT64   NOT NULL,
  je_target         NUMERIC NOT NULL
);

-- ------------------------------------------------------------------ submissions
-- One row per facility per day, mirroring the KoBo form. Partitioned by report
-- date because every dashboard query filters or groups by it.

CREATE TABLE IF NOT EXISTS je_jhapa.reports (
  submission_uuid       STRING NOT NULL,   -- KoBo _uuid - the dedup key
  submitted_at          TIMESTAMP,         -- KoBo _submission_time
  ingested_at           TIMESTAMP NOT NULL,

  report_date_ad        DATE NOT NULL,

  local_level_code      STRING NOT NULL,
  ward_code             STRING NOT NULL,
  ward_no               INT64,
  facility_name         STRING,            -- free text, a label only, never a key
  facility_lat          FLOAT64,
  facility_lon          FLOAT64,

  reporter_name         STRING,
  reporter_designation  STRING,
  reporter_phone        STRING,

  v_30_60_f             INT64,
  v_30_60_m             INT64,
  v_60plus_f            INT64,
  v_60plus_m            INT64,
  total_doses           INT64,

  vaccine_opening       INT64,
  vaccine_received      INT64,
  vaccine_used          INT64,             -- vials opened
  vaccine_closing       INT64,
  diluent_opening       INT64,
  diluent_received      INT64,
  diluent_used          INT64,
  diluent_closing       INT64,
  ad_syr_opening        INT64,
  ad_syr_received       INT64,
  ad_syr_used           INT64,
  ad_syr_closing        INT64,
  recon_syr_opening     INT64,
  recon_syr_received    INT64,
  recon_syr_used        INT64,
  recon_syr_closing     INT64,
  safety_box_opening    INT64,
  safety_box_received   INT64,
  safety_box_used       INT64,
  safety_box_closing    INT64,

  vials_discarded       INT64,
  doses_per_vial        INT64,
  doses_available       INT64,
  wastage_rate          FLOAT64,

  aefi_minor            INT64,
  aefi_serious          INT64,
  aefi_remarks          STRING,
  remarks               STRING
)
PARTITION BY report_date_ad
CLUSTER BY local_level_code, ward_code;

-- --------------------------------------------------------------- deduplicated base
-- The webhook fires on create and may retry up to three times, and the daily
-- reconcile reloads everything KoBo holds. Both paths can therefore land the
-- same _uuid more than once. Every view below reads through this one, so a
-- duplicated delivery can never double-count a facility's doses.

CREATE OR REPLACE VIEW je_jhapa.v_reports AS
SELECT * EXCEPT (row_num)
FROM (
  SELECT
    *,
    ROW_NUMBER() OVER (PARTITION BY submission_uuid ORDER BY ingested_at DESC) AS row_num
  FROM je_jhapa.reports
)
WHERE row_num = 1;

-- ------------------------------------------------------------------ ward roll-up
-- LEFT JOIN from ref_ward so all 131 wards appear from day one, including those
-- that have not yet reported - a ward missing from the map is a real signal.

CREATE OR REPLACE VIEW je_jhapa.v_ward_cumulative AS
SELECT
  w.code                                   AS ward_code,
  w.local_level_code,
  ll.name                                  AS local_level_name,
  w.ward_no,
  w.population,
  w.je_target,
  COALESCE(SUM(r.v_30_60_f),  0)           AS v_30_60_f,
  COALESCE(SUM(r.v_30_60_m),  0)           AS v_30_60_m,
  COALESCE(SUM(r.v_60plus_f), 0)           AS v_60plus_f,
  COALESCE(SUM(r.v_60plus_m), 0)           AS v_60plus_m,
  COALESCE(SUM(r.total_doses), 0)          AS total_doses,
  COALESCE(SUM(r.aefi_minor),   0)         AS aefi_minor,
  COALESCE(SUM(r.aefi_serious), 0)         AS aefi_serious,
  COUNT(r.submission_uuid)                 AS report_count,
  MAX(r.report_date_ad)                    AS last_report_date,
  SAFE_DIVIDE(COALESCE(SUM(r.total_doses), 0), w.je_target) * 100 AS coverage_pct
FROM je_jhapa.ref_ward w
JOIN je_jhapa.ref_local_level ll ON ll.code = w.local_level_code
LEFT JOIN je_jhapa.v_reports r   ON r.ward_code = w.code
GROUP BY w.code, w.local_level_code, ll.name, w.ward_no, w.population, w.je_target;

-- ----------------------------------------------------------- local-level roll-up

CREATE OR REPLACE VIEW je_jhapa.v_local_level_cumulative AS
SELECT
  ll.code                                  AS local_level_code,
  ll.name                                  AS local_level_name,
  ll.population,
  ll.je_target,
  ll.ward_count,
  COALESCE(SUM(r.v_30_60_f),  0)           AS v_30_60_f,
  COALESCE(SUM(r.v_30_60_m),  0)           AS v_30_60_m,
  COALESCE(SUM(r.v_60plus_f), 0)           AS v_60plus_f,
  COALESCE(SUM(r.v_60plus_m), 0)           AS v_60plus_m,
  COALESCE(SUM(r.total_doses), 0)          AS total_doses,
  COALESCE(SUM(r.aefi_minor),   0)         AS aefi_minor,
  COALESCE(SUM(r.aefi_serious), 0)         AS aefi_serious,
  COUNT(DISTINCT r.ward_code)              AS wards_reporting,
  SAFE_DIVIDE(COALESCE(SUM(r.total_doses), 0), ll.je_target) * 100 AS coverage_pct
FROM je_jhapa.ref_local_level ll
LEFT JOIN je_jhapa.v_reports r ON r.local_level_code = ll.code
GROUP BY ll.code, ll.name, ll.population, ll.je_target, ll.ward_count;

-- --------------------------------------------------------------- district by day
-- Daily and running totals for the coverage-over-time chart.

CREATE OR REPLACE VIEW je_jhapa.v_district_daily AS
WITH daily AS (
  SELECT
    report_date_ad,
    SUM(total_doses)             AS doses,
    SUM(v_30_60_f)               AS v_30_60_f,
    SUM(v_30_60_m)               AS v_30_60_m,
    SUM(v_60plus_f)              AS v_60plus_f,
    SUM(v_60plus_m)              AS v_60plus_m,
    COUNT(*)                     AS report_count,
    COUNT(DISTINCT ward_code)    AS wards_reporting
  FROM je_jhapa.v_reports
  GROUP BY report_date_ad
),
district AS (
  SELECT SUM(je_target) AS je_target FROM je_jhapa.ref_local_level
)
SELECT
  d.*,
  SUM(d.doses) OVER (ORDER BY d.report_date_ad) AS cumulative_doses,
  SAFE_DIVIDE(SUM(d.doses) OVER (ORDER BY d.report_date_ad), t.je_target) * 100
    AS cumulative_coverage_pct
FROM daily d
CROSS JOIN district t
ORDER BY d.report_date_ad;

-- ------------------------------------------------------------ age x sex breakdown
-- Long format, one row per age/sex cell, so the stacked bar binds directly.

CREATE OR REPLACE VIEW je_jhapa.v_age_sex_breakdown AS
SELECT 'age_30_60' AS age_band, 'female' AS sex, COALESCE(SUM(v_30_60_f),  0) AS doses FROM je_jhapa.v_reports
UNION ALL
SELECT 'age_30_60',             'male',           COALESCE(SUM(v_30_60_m),  0) FROM je_jhapa.v_reports
UNION ALL
SELECT 'age_60_plus',           'female',         COALESCE(SUM(v_60plus_f), 0) FROM je_jhapa.v_reports
UNION ALL
SELECT 'age_60_plus',           'male',           COALESCE(SUM(v_60plus_m), 0) FROM je_jhapa.v_reports;

-- ---------------------------------------------------------------- commodity stock
-- Closing balance is a running quantity, not a sum: the latest report per ward
-- is the current stock. Consumption and wastage do sum across the campaign.

CREATE OR REPLACE VIEW je_jhapa.v_commodity_stock AS
WITH latest AS (
  SELECT
    ward_code,
    local_level_code,
    vaccine_closing, diluent_closing, ad_syr_closing,
    recon_syr_closing, safety_box_closing,
    report_date_ad,
    ROW_NUMBER() OVER (PARTITION BY ward_code ORDER BY report_date_ad DESC, ingested_at DESC) AS rn
  FROM je_jhapa.v_reports
),
consumed AS (
  SELECT
    ward_code,
    SUM(vaccine_used)     AS vials_used,
    SUM(vials_discarded)  AS vials_discarded,
    SUM(doses_available)  AS doses_available,
    SUM(total_doses)      AS doses_given
  FROM je_jhapa.v_reports
  GROUP BY ward_code
)
SELECT
  l.ward_code,
  l.local_level_code,
  l.report_date_ad            AS stock_as_of,
  l.vaccine_closing,
  l.diluent_closing,
  l.ad_syr_closing,
  l.recon_syr_closing,
  l.safety_box_closing,
  c.vials_used,
  c.vials_discarded,
  c.doses_available,
  c.doses_given,
  SAFE_DIVIDE(c.doses_available - c.doses_given, c.doses_available) * 100 AS wastage_pct
FROM latest l
JOIN consumed c ON c.ward_code = l.ward_code
WHERE l.rn = 1;
