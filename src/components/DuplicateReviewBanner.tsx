import { AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { DuplicateReviewRow } from '../lib/api'
import { formatNumeral, formatDate } from '../lib/nepali'
import { useLang } from '../lib/i18n'

interface Props {
  rows: DuplicateReviewRow[]
}

// Exact-repeat resubmissions are already collapsed in BigQuery (v_reports) -
// what lands here is only the ambiguous case: same ward, same date, same
// facility, but different numbers, which could be a real correction or a
// second genuine session. Both submissions are still being summed into every
// total on the page, so this is surfaced rather than silently resolved.
export function DuplicateReviewBanner({ rows }: Props) {
  const { lang, t } = useLang()
  const n = (v: number | string) => formatNumeral(v, lang)

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
      <div className="flex items-start gap-2.5 px-4 pt-3.5 pb-2">
        <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-amber-800">
            {t('duplicateReviewTitle')} ({n(rows.length)})
          </h3>
          <p className="text-xs text-amber-700 mt-0.5">{t('duplicateReviewDesc')}</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-t border-amber-200 text-xs font-medium text-amber-700">
              <th className="text-left px-4 py-2">{t('colDate')}</th>
              <th className="text-left px-4 py-2">{t('colLocalLevel')}</th>
              <th className="text-left px-4 py-2">{t('colWardNo')}</th>
              <th className="text-left px-4 py-2">{t('colFacility')}</th>
              <th className="text-left px-4 py-2">{t('colSubmissions')}</th>
              <th className="text-left px-4 py-2">{t('colCombinedDoses')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.ward_code}_${r.report_date_ad}`} className="border-t border-amber-100">
                <td className="px-4 py-2 text-amber-900 whitespace-nowrap">{formatDate(r.report_date_ad, lang)}</td>
                <td className="px-4 py-2 text-amber-900">{r.local_level_name}</td>
                <td className="px-4 py-2 text-amber-900">
                  <Link to={`/ward/${r.ward_code}`} className="hover:underline font-medium">{n(r.ward_no)}</Link>
                </td>
                <td className="px-4 py-2 text-amber-900">{r.facility_name || '—'}</td>
                <td className="px-4 py-2 text-amber-900 tabular-nums">{n(r.submission_count)}</td>
                <td className="px-4 py-2 text-amber-900 tabular-nums">{n(r.combined_doses)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
