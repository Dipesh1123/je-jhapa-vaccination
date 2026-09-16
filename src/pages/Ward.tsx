import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api, type WardRow, type AgeSexRow } from '../lib/api'
import { formatNumeral, formatDate } from '../lib/nepali'
import { sequentialBlue } from '../lib/palette'
import { useLang } from '../lib/i18n'
import { AgeSexChart } from '../components/charts/AgeSexChart'
import { ErrorBanner } from '../components/ErrorBanner'
import { Spinner } from '../components/Spinner'

const BAR_COLOR = sequentialBlue[450]

function ageSexFromWard(w: WardRow): AgeSexRow[] {
  return [
    { age_band: 'age_30_60', sex: 'female', doses: w.v_30_60_f },
    { age_band: 'age_30_60', sex: 'male', doses: w.v_30_60_m },
    { age_band: 'age_60_plus', sex: 'female', doses: w.v_60plus_f },
    { age_band: 'age_60_plus', sex: 'male', doses: w.v_60plus_m },
  ]
}

export function Ward() {
  const { lang, t } = useLang()
  const n = (v: number | string) => formatNumeral(v, lang)
  const { code } = useParams<{ code: string }>()
  const [ward, setWard] = useState<WardRow | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!code) return
    setWard(null)
    api.ward(code).then((d) => setWard(d.ward)).catch((e) => setError(String(e)))
  }, [code])

  if (error) return <div className="p-6"><ErrorBanner message={error} /></div>
  if (!ward) return <div className="p-6"><Spinner /></div>

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
      <Link to={`/palika/${ward.local_level_code}`} className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:underline">
        <ArrowLeft size={16} /> {t('backToPalika', { name: ward.local_level_name })}
      </Link>

      <div>
        <h1 className="text-lg font-semibold text-slate-800">
          {ward.local_level_name} {t('wardLabel', { n: n(ward.ward_no) })}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">{t('wardProfileSubtitle')}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label={t('colPopulation')} value={n(ward.population.toLocaleString())} />
        <StatTile label={t('target')} value={n(Math.round(ward.je_target).toLocaleString())} />
        <StatTile label={t('colVaccinated')} value={n(ward.total_doses.toLocaleString())} />
        <StatTile label={t('colReportsReceived')} value={n(ward.report_count)} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('colProgress')}</h3>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.min(ward.coverage_pct, 100)}%`, backgroundColor: BAR_COLOR }} />
          </div>
          <span className="text-sm font-medium text-slate-700 tabular-nums">{n(ward.coverage_pct.toFixed(1))}%</span>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          {t('colLastReport')}: {ward.last_report_date ? formatDate(ward.last_report_date, lang) : t('noReportYet')}
        </p>
      </div>

      <AgeSexChart ageSex={ageSexFromWard(ward)} />

      <div className="grid grid-cols-2 gap-3">
        <StatTile label={t('colAefiMinor')} value={n(ward.aefi_minor)} />
        <StatTile label={t('colAefiSerious')} value={n(ward.aefi_serious)} />
      </div>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-800 tabular-nums mt-0.5">{value}</p>
    </div>
  )
}
