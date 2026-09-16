import { useEffect, useState } from 'react'
import { Target, Syringe, TrendingUp, CalendarDays, TrendingDown, Minus } from 'lucide-react'
import { api, type DashboardData, type PalikaRow } from '../lib/api'
import { formatNumeral, campaignDayNumber, campaignDurationDays, campaignDaysRemaining } from '../lib/nepali'
import { status } from '../lib/palette'
import { useLang } from '../lib/i18n'
import { KpiTile } from '../components/KpiTile'
import { CoverageTrendChart } from '../components/charts/CoverageTrendChart'
import { AgeSexChart } from '../components/charts/AgeSexChart'
import { PalikaLeagueTable } from '../components/PalikaLeagueTable'
import { WardTable } from '../components/WardTable'
import { ErrorBanner } from '../components/ErrorBanner'
import { Spinner } from '../components/Spinner'

export function Dashboard() {
  const { lang, t } = useLang()
  const [data, setData] = useState<DashboardData | null>(null)
  // The municipality dropdown's options - captured once from the first
  // (district-wide) response, since `palikas` is only populated at that
  // scope and we still need the list after drilling into one of them.
  const [municipalities, setMunicipalities] = useState<PalikaRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selectedLocalLevel, setSelectedLocalLevel] = useState('') // '' = overall
  const [selectedWard, setSelectedWard] = useState('') // '' = all wards in the selected municipality

  useEffect(() => {
    const params = selectedWard
      ? ({ scope: 'ward', code: selectedWard } as const)
      : selectedLocalLevel
        ? ({ scope: 'local_level', code: selectedLocalLevel } as const)
        : undefined
    setData(null)
    api.dashboard(params).then((d) => {
      setData(d)
      if (!params && d.palikas) setMunicipalities(d.palikas)
    }).catch((e) => setError(String(e)))
  }, [selectedLocalLevel, selectedWard])

  if (error) return <div className="p-6"><ErrorBanner message={error} /></div>
  if (!data) return <div className="p-6"><Spinner /></div>

  const { summary, daily, ageSex } = data
  const dayN = campaignDayNumber()
  const duration = campaignDurationDays()
  const daysLeft = campaignDaysRemaining()
  const n = (v: number | string) => formatNumeral(v, lang)

  const wardCount = municipalities.find((m) => m.local_level_code === selectedLocalLevel)?.ward_count ?? 0

  // Pace status: never color-alone - always paired with an icon and a label,
  // using the fixed status palette (never reused as a series color).
  const expectedPct = duration > 0 ? (Math.min(dayN, duration) / duration) * 100 : 0
  const gap = summary.coverage_pct - expectedPct
  const pace = gap >= 2
    ? { label: t('paceAhead'), color: status.good, Icon: TrendingUp }
    : gap <= -2
      ? { label: t('paceBehind'), color: status.critical, Icon: TrendingDown }
      : { label: t('paceOnTrack'), color: status.warning, Icon: Minus }

  const dosesPerDay = dayN > 0 ? Math.round(summary.vaccinated / Math.max(dayN, 1)) : 0

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">
          {t('campaignTitle')}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {data.name && (
            <span className="font-medium text-slate-600">
              {data.name}{data.ward_no ? ` ${t('wardLabel', { n: n(data.ward_no) })}` : ''} ·{' '}
            </span>
          )}
          {t('dayOf', { n: n(dayN), total: n(duration) })}
          {daysLeft > 0 && t('daysLeft', { n: n(daysLeft) })}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-lg p-3">
        <select
          value={selectedLocalLevel}
          onChange={(e) => { setSelectedLocalLevel(e.target.value); setSelectedWard('') }}
          className="text-sm border border-slate-200 rounded-md px-2.5 py-1.5 bg-white text-slate-700 min-w-0"
        >
          <option value="">{t('filterAll')}</option>
          {municipalities.map((m) => (
            <option key={m.local_level_code} value={m.local_level_code}>{m.local_level_name}</option>
          ))}
        </select>
        <select
          value={selectedWard}
          onChange={(e) => setSelectedWard(e.target.value)}
          disabled={!selectedLocalLevel}
          className="text-sm border border-slate-200 rounded-md px-2.5 py-1.5 bg-white text-slate-700 min-w-0 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <option value="">{t('filterAllWards')}</option>
          {selectedLocalLevel && Array.from({ length: wardCount }, (_, i) => i + 1).map((wardNo) => (
            <option key={wardNo} value={`${selectedLocalLevel}_${wardNo}`}>
              {t('filterWardLabel')} {n(wardNo)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile icon={Target} hue="blue" label={t('kpiTarget')}
          value={n(Math.round(summary.je_target).toLocaleString())} />
        <KpiTile icon={Syringe} hue="green" label={t('kpiVaccinated')}
          value={n(summary.vaccinated.toLocaleString())} />
        <KpiTile icon={CalendarDays} hue="purple" label={t('kpiDailyAvg')}
          value={n(dosesPerDay.toLocaleString())}
          sublabel={t('kpiDailyAvgSub')} />
        <KpiTile icon={Target} hue="amber" label={t('kpiOverall')}
          value={`${n(summary.coverage_pct.toFixed(1))}%`} />
      </div>

      <div
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium"
        style={{ backgroundColor: `${pace.color}1a`, color: pace.color }}
      >
        <pace.Icon size={16} />
        {pace.label}
        <span className="text-slate-500 font-normal">
          {t('expected', { n: n(expectedPct.toFixed(1)) })}
        </span>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <CoverageTrendChart daily={daily} campaignStart={summary.campaign_start} campaignEnd={summary.campaign_end} />
        <AgeSexChart ageSex={ageSex} />
      </div>

      {data.scope === 'district' && data.palikas && <PalikaLeagueTable palikas={data.palikas} />}

      {data.scope === 'local_level' && data.wards && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <h3 className="text-sm font-semibold text-slate-700 px-4 pt-4 pb-2">{t('progressByWard')}</h3>
          <WardTable wards={data.wards} />
        </div>
      )}
    </div>
  )
}
