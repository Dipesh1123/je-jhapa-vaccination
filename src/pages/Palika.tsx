import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api, type PalikaDetail } from '../lib/api'
import { formatNumeral, formatDate } from '../lib/nepali'
import { sequentialBlue } from '../lib/palette'
import { useLang } from '../lib/i18n'
import { ErrorBanner } from '../components/ErrorBanner'
import { Spinner } from '../components/Spinner'

const BAR_COLOR = sequentialBlue[450]

export function Palika() {
  const { lang, t } = useLang()
  const n = (v: number | string) => formatNumeral(v, lang)
  const { code } = useParams<{ code: string }>()
  const [data, setData] = useState<PalikaDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!code) return
    setData(null)
    api.palika(code).then(setData).catch((e) => setError(String(e)))
  }, [code])

  if (error) return <div className="p-6"><ErrorBanner message={error} /></div>
  if (!data) return <div className="p-6"><Spinner /></div>

  const { palika, wards } = data

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:underline">
        <ArrowLeft size={16} /> {t('backToDashboard')}
      </Link>

      <div>
        <h1 className="text-lg font-semibold text-slate-800">{palika.local_level_name}</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {t('wardsReported', { a: n(palika.wards_reporting), b: n(palika.ward_count) })} ·
          {' '}{t('colPopulation')} {n(palika.population.toLocaleString())} ·
          {' '}{t('target')} {n(Math.round(palika.je_target).toLocaleString())}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <h3 className="text-sm font-semibold text-slate-700 px-4 pt-4 pb-2">{t('progressByWard')}</h3>
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
      </div>
    </div>
  )
}
