import { useEffect, useState } from 'react'
import { Target, Syringe, TrendingUp, CalendarDays, TrendingDown, Minus } from 'lucide-react'
import { api, type DashboardData } from '../lib/api'
import { formatNumeral, campaignDayNumber, campaignDurationDays, campaignDaysRemaining } from '../lib/nepali'
import { status } from '../lib/palette'
import { useLang } from '../lib/i18n'
import { KpiTile } from '../components/KpiTile'
import { CoverageTrendChart } from '../components/charts/CoverageTrendChart'
import { AgeSexChart } from '../components/charts/AgeSexChart'
import { PalikaLeagueTable } from '../components/PalikaLeagueTable'
import { ErrorBanner } from '../components/ErrorBanner'
import { Spinner } from '../components/Spinner'

export function Dashboard() {
  const { lang, t } = useLang()
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.dashboard().then(setData).catch((e) => setError(String(e)))
  }, [])

  if (error) return <div className="p-6"><ErrorBanner message={error} /></div>
  if (!data) return <div className="p-6"><Spinner /></div>

  const { district, daily, ageSex, palikas } = data
  const dayN = campaignDayNumber()
  const duration = campaignDurationDays()
  const daysLeft = campaignDaysRemaining()
  const n = (v: number | string) => formatNumeral(v, lang)

  // Pace status: never color-alone - always paired with an icon and a label,
  // using the fixed status palette (never reused as a series color).
  const expectedPct = duration > 0 ? (Math.min(dayN, duration) / duration) * 100 : 0
  const gap = district.coverage_pct - expectedPct
  const pace = gap >= 2
    ? { label: t('paceAhead'), color: status.good, Icon: TrendingUp }
    : gap <= -2
      ? { label: t('paceBehind'), color: status.critical, Icon: TrendingDown }
      : { label: t('paceOnTrack'), color: status.warning, Icon: Minus }

  const dosesPerDay = dayN > 0 ? Math.round(district.vaccinated / Math.max(dayN, 1)) : 0

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">
          {t('campaignTitle')}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {t('dayOf', { n: n(dayN), total: n(duration) })}
          {daysLeft > 0 && t('daysLeft', { n: n(daysLeft) })}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile icon={Target} hue="blue" label={t('kpiTarget')}
          value={n(Math.round(district.je_target).toLocaleString())} />
        <KpiTile icon={Syringe} hue="green" label={t('kpiVaccinated')}
          value={n(district.vaccinated.toLocaleString())} />
        <KpiTile icon={CalendarDays} hue="purple" label={t('kpiDailyAvg')}
          value={n(dosesPerDay.toLocaleString())}
          sublabel={t('kpiDailyAvgSub')} />
        <KpiTile icon={Target} hue="amber" label={t('kpiOverall')}
          value={`${n(district.coverage_pct.toFixed(1))}%`} />
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
        <CoverageTrendChart daily={daily} campaignStart={district.campaign_start} campaignEnd={district.campaign_end} />
        <AgeSexChart ageSex={ageSex} />
      </div>

      <PalikaLeagueTable palikas={palikas} />
    </div>
  )
}
