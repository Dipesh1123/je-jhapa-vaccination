// Typed client for the JSON endpoints in api/. Every shape here matches what
// the corresponding route in api/*.js actually returns - see api/_lib/csv.js
// flattenRow for why these are plain numbers/strings and not BigQuery's
// {value}-wrapped NUMERIC/DATE types.

// Shape of the KPI summary at any dashboard scope - the whole district, one
// local level, or one ward.
export interface ScopeSummary {
  population: number
  je_target: number
  vaccinated: number
  coverage_pct: number
  campaign_start: string
  campaign_end: string
}

export interface DailyRow {
  report_date_ad: string
  doses: number
  v_30_60_f: number
  v_30_60_m: number
  v_60plus_f: number
  v_60plus_m: number
  report_count: number
  wards_reporting: number
  cumulative_doses: number
  cumulative_coverage_pct: number
}

export interface AgeSexRow {
  age_band: 'age_30_60' | 'age_60_plus'
  sex: 'female' | 'male'
  doses: number
}

export interface PalikaRow {
  local_level_code: string
  local_level_name: string
  population: number
  je_target: number
  ward_count: number
  v_30_60_f: number
  v_30_60_m: number
  v_60plus_f: number
  v_60plus_m: number
  total_doses: number
  aefi_minor: number
  aefi_serious: number
  wards_reporting: number
  coverage_pct: number
}

export interface WardRow {
  ward_code: string
  local_level_code: string
  local_level_name: string
  ward_no: number
  population: number
  je_target: number
  v_30_60_f: number
  v_30_60_m: number
  v_60plus_f: number
  v_60plus_m: number
  total_doses: number
  aefi_minor: number
  aefi_serious: number
  report_count: number
  last_report_date: string | null
  coverage_pct: number
}

export interface NonReportingWard {
  ward_code: string
  local_level_code: string
  local_level_name: string
  ward_no: number
  population: number
  last_report_date: string | null
}

export interface DuplicateReviewRow {
  ward_code: string
  local_level_code: string
  local_level_name: string
  ward_no: number
  report_date_ad: string
  facility_name: string | null
  submission_count: number
  combined_doses: number
}

export interface DashboardData {
  scope: 'district' | 'local_level' | 'ward'
  code: string | null
  name: string | null
  ward_no: number | null
  summary: ScopeSummary
  daily: DailyRow[]
  ageSex: AgeSexRow[]
  palikas: PalikaRow[] | null
  wards: WardRow[] | null
  duplicates: DuplicateReviewRow[] | null
  notReportingToday: { today: string; wards: NonReportingWard[] } | null
}

export interface FacilityPoint {
  facility_name: string | null
  local_level_code: string
  ward_no: number
  facility_lat: number
  facility_lon: number
  total_doses: number
  report_date_ad: string
}

export interface MapData {
  palikas: PalikaRow[]
  wards: WardRow[]
  facilities: FacilityPoint[]
}

export interface PalikaDetail {
  palika: PalikaRow
  wards: WardRow[]
}

export interface WardDetail {
  ward: WardRow
}

export interface CommodityRow {
  ward_code: string
  local_level_code: string
  local_level_name: string
  ward_no: number
  stock_as_of: string | null
  vaccine_closing: number | null
  diluent_closing: number | null
  ad_syr_closing: number | null
  recon_syr_closing: number | null
  safety_box_closing: number | null
  vials_used: number | null
  vials_discarded: number | null
  doses_available: number | null
  doses_given: number | null
  wastage_pct: number | null
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) {
    throw new Error(`${path} -> HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  dashboard: (params?: { scope: 'local_level' | 'ward'; code: string }) =>
    getJson<DashboardData>(
      params
        ? `/api/dashboard-data?scope=${params.scope}&code=${encodeURIComponent(params.code)}`
        : '/api/dashboard-data'
    ),
  map: () => getJson<MapData>('/api/map-data'),
  palika: (code: string) => getJson<PalikaDetail>(`/api/palika-data?code=${encodeURIComponent(code)}`),
  ward: (code: string) => getJson<WardDetail>(`/api/ward-data?code=${encodeURIComponent(code)}`),
  commodity: () => getJson<{ rows: CommodityRow[] }>('/api/commodity-data'),
}
