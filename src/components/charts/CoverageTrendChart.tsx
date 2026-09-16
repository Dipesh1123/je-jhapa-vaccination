import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { DailyRow } from '../../lib/api'
import { trendSeries, ink } from '../../lib/palette'
import { formatDate, formatNumeral } from '../../lib/nepali'
import { useLang } from '../../lib/i18n'

interface Props {
  daily: DailyRow[]
  campaignStart: string
  campaignEnd: string
}

interface Point {
  date: string
  dayIndex: number
  actual: number | null
  pace: number
}

/** Builds the full campaign-day axis (day 1..N) so the "required pace" line
 *  always spans the whole campaign, even on day 1 when `actual` has at most
 *  one point. Two series, fixed order (trendSeries.actual/.pace) - identity
 *  never changes with how much data has arrived. */
function buildSeries(daily: DailyRow[], start: string, end: string): Point[] {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const durationDays = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1

  const byDate = new Map(daily.map((d) => [d.report_date_ad, d.cumulative_coverage_pct]))

  const points: Point[] = []
  for (let i = 0; i < durationDays; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    const iso = d.toISOString().slice(0, 10)
    points.push({
      date: iso,
      dayIndex: i + 1,
      actual: byDate.has(iso) ? Number(byDate.get(iso)) : null,
      pace: ((i + 1) / durationDays) * 100,
    })
  }
  return points
}

export function CoverageTrendChart({ daily, campaignStart, campaignEnd }: Props) {
  const { lang, t } = useLang()
  const n = (v: number | string) => formatNumeral(v, lang)
  const data = buildSeries(daily, campaignStart, campaignEnd)
  const seriesLabel = (name: string) => (name === 'actual' ? t('seriesActual') : t('seriesPace'))

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('coverageTrendTitle')}</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={ink.light.gridline} vertical={false} />
          <XAxis
            dataKey="dayIndex"
            tickFormatter={(v: number) => n(v)}
            stroke={ink.light.muted}
            fontSize={12}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v: number) => `${n(v)}%`}
            stroke={ink.light.muted}
            fontSize={12}
            tickLine={false}
            width={48}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              `${n(Math.round(value * 10) / 10)}%`,
              seriesLabel(name),
            ]}
            labelFormatter={(dayIndex: number) => {
              const p = data[dayIndex - 1]
              return p ? formatDate(p.date, lang) : ''
            }}
          />
          <Legend formatter={(value: string) => seriesLabel(value)} />
          <Line
            type="monotone"
            dataKey="pace"
            stroke={trendSeries.pace.light}
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={false}
            name="pace"
          />
          <Line
            type="monotone"
            dataKey="actual"
            stroke={trendSeries.actual.light}
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
            name="actual"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
