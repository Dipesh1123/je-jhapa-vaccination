import { Link } from 'react-router-dom'
import type { WardRow } from '../lib/api'
import { formatNumeral, formatDate } from '../lib/nepali'
import { sequentialBlue } from '../lib/palette'
import { useLang } from '../lib/i18n'

const BAR_COLOR = sequentialBlue[450]

interface Props {
  wards: WardRow[]
}

// Shared between /palika/:code and the dashboard's municipality filter - one
// ward table, one place that defines what a ward row looks like.
export function WardTable({ wards }: Props) {
  const { lang, t } = useLang()
  const n = (v: number | string) => formatNumeral(v, lang)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-xs font-medium text-slate-500">
            <th className="text-left px-4 py-2">{t('colWardNo')}</th>
            <th className="text-left px-4 py-2">{t('colPopulation')}</th>
            <th className="text-left px-4 py-2">{t('colVaccinated')}</th>
            <th className="text-left px-4 py-2">{t('colProgress')}</th>
            <th className="text-left px-4 py-2">{t('colLastReport')}</th>
          </tr>
        </thead>
        <tbody>
          {wards.map((w) => (
            <tr key={w.ward_code} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
              <td className="px-4 py-2.5 font-medium">
                <Link to={`/ward/${w.ward_code}`} className="text-blue-700 hover:underline">{n(w.ward_no)}</Link>
              </td>
              <td className="px-4 py-2.5 text-slate-600 tabular-nums">{n(w.population.toLocaleString())}</td>
              <td className="px-4 py-2.5 text-slate-600 tabular-nums">{n(w.total_doses.toLocaleString())}</td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden min-w-16">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(w.coverage_pct, 100)}%`, backgroundColor: BAR_COLOR }} />
                  </div>
                  <span className="text-xs font-medium text-slate-700 tabular-nums w-12 text-right">
                    {n(w.coverage_pct.toFixed(1))}%
                  </span>
                </div>
              </td>
              <td className="px-4 py-2.5 text-slate-500 text-xs">
                {w.last_report_date ? formatDate(w.last_report_date, lang) : t('noReportYet')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
