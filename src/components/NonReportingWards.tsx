import { ClipboardList } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { NonReportingWard } from '../lib/api'
import { formatNumeral, formatDate } from '../lib/nepali'
import { useLang } from '../lib/i18n'

interface Props {
  today: string
  wards: NonReportingWard[]
}

// The one question a supervisor actually asks each evening - "who hasn't
// sent today's numbers" - answered by name rather than left as a count
// buried in the league table's "{a}/{b} wards reported" subtext. Only
// rendered once the campaign is actually running (see dashboard-data.js);
// before day 1 every ward legitimately has nothing to report yet.
export function NonReportingWards({ today, wards }: Props) {
  const { lang, t } = useLang()
  const n = (v: number | string) => formatNumeral(v, lang)

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-start gap-2.5 px-4 pt-3.5 pb-2">
        <ClipboardList size={16} className="text-slate-500 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-slate-700">
            {t('nonReportingTitle')} ({n(wards.length)})
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('nonReportingDesc', { date: formatDate(today, lang) })}
          </p>
        </div>
      </div>
      {wards.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-slate-500">{t('allWardsReportedToday')}</p>
      ) : (
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-b border-slate-100 text-xs font-medium text-slate-500 sticky top-0 bg-white">
                <th className="text-left px-4 py-2">{t('colLocalLevel')}</th>
                <th className="text-left px-4 py-2">{t('colWardNo')}</th>
                <th className="text-left px-4 py-2">{t('colPopulation')}</th>
                <th className="text-left px-4 py-2">{t('colLastReport')}</th>
              </tr>
            </thead>
            <tbody>
              {wards.map((w) => (
                <tr key={w.ward_code} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-2 text-slate-700">{w.local_level_name}</td>
                  <td className="px-4 py-2">
                    <Link to={`/ward/${w.ward_code}`} className="text-blue-700 hover:underline font-medium">{n(w.ward_no)}</Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600 tabular-nums">{n(w.population.toLocaleString())}</td>
                  <td className="px-4 py-2 text-slate-500 text-xs">
                    {w.last_report_date ? formatDate(w.last_report_date, lang) : t('neverReported')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
