// BS date/numeral helpers - the same pattern as
// school-health-nurse/src/lib/utils.ts, so the two Health Office apps agree
// on how a Nepali date looks.

import NepaliDate from 'nepali-date-converter'
import type { Lang } from './i18n'

const NP_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९']

export function toNepaliNumeral(n: number | string): string {
  return String(n).replace(/\d/g, d => NP_DIGITS[+d])
}

/** Devanagari numerals in Nepali, plain Arabic numerals in English - the one
 *  place every KPI/table/chart number in the app goes through. */
export function formatNumeral(n: number | string, lang: Lang): string {
  return lang === 'ne' ? toNepaliNumeral(n) : String(n)
}

export const NEPALI_MONTHS = [
  'बैशाख', 'जेठ', 'आषाढ', 'श्रावण', 'भाद्र', 'आश्विन',
  'कार्तिक', 'मंसिर', 'पौष', 'माघ', 'फागुन', 'चैत्र',
]

/** "१९ आश्विन २०८३" from an AD date string (e.g. "2026-10-05"). The form no
 *  longer asks for BS directly - this is how every BS date in the dashboard
 *  is derived, so there is exactly one place doing the conversion. */
export function formatBsDate(adDateStr: string | null | undefined): string {
  if (!adDateStr) return '—'
  try {
    const nd = new NepaliDate(new Date(adDateStr))
    const day = toNepaliNumeral(nd.getDate())
    const month = NEPALI_MONTHS[nd.getMonth()]
    const year = toNepaliNumeral(nd.getYear())
    return `${day} ${month} ${year}`
  } catch {
    return '—'
  }
}

/** BS date in Nepali, short AD date ("5 Oct 2026") in English. */
export function formatDate(adDateStr: string | null | undefined, lang: Lang): string {
  if (!adDateStr) return '—'
  if (lang === 'ne') return formatBsDate(adDateStr)
  try {
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(adDateStr))
  } catch {
    return '—'
  }
}

// Campaign window - must match data/reference.json and api/_lib/campaign.js.
// Confirmed against the daily-reporting sheet's own day-blocks: 11 days,
// Day 1 = 5 Ashwin 2083 (2026-10-05) through Day 11 = 15 Ashwin (2026-10-15).
export const CAMPAIGN_START = '2026-10-05'
export const CAMPAIGN_END = '2026-10-15'

function daysBetween(a: Date, b: Date): number {
  const ms = 24 * 60 * 60 * 1000
  return Math.round((b.setHours(0, 0, 0, 0) - a.setHours(0, 0, 0, 0)) / ms)
}

export function campaignDurationDays(): number {
  return daysBetween(new Date(CAMPAIGN_START), new Date(CAMPAIGN_END)) + 1
}

/** Day N of the campaign for `today` (1-indexed). Clamped so the KPI tile
 *  reads sensibly before day 1 or after the last day, rather than showing a
 *  negative or out-of-range number. */
export function campaignDayNumber(today: Date = new Date()): number {
  const n = daysBetween(new Date(CAMPAIGN_START), new Date(today)) + 1
  return Math.min(Math.max(n, 0), campaignDurationDays())
}

export function campaignDaysRemaining(today: Date = new Date()): number {
  const n = daysBetween(new Date(today), new Date(CAMPAIGN_END))
  return Math.max(n, 0)
}
