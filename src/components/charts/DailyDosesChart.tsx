import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { DailyRow } from '../../lib/api'
import { sequentialBlue, ink } from '../../lib/palette'
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
  doses: number | null
}

// Same full campaign-day axis as CoverageTrendChart, so the two line up when
// shown side by side.
function buildSeries(daily: DailyRow[], start: string, end: string): Point[] {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const durationDays = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1

  const byDate = new Map(daily.map((d) => [d.report_date_ad, d.doses]))

  const points: Point[] = []
  for (let i = 0; i < durationDays; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    const iso = d.toISOString().slice(0, 10)
    points.push({ date: iso, dayIndex: i + 1, doses: byDate.has(iso) ? Number(byDate.get(iso)) : null })
  }
  return points
}

// Doses given per day - a magnitude, not an identity, so one sequential hue
// rather than a categorical color. A cumulative line (CoverageTrendChart)
// only ever goes up, so a slow day or a stalled ward is invisible in it;
// this is the chart that actually shows it.
export function DailyDosesChart({ daily, campaignStart, campaignEnd }: Props) {
  const { lang, t } = useLang()
  const n = (v: number | string) => formatNumeral(v, lang)
  const data = buildSeries(daily, campaignStart, campaignEnd)

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('dailyDosesTitle')}</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={ink.light.gridline} vertical={false} />
          <XAxis
            dataKey="dayIndex"
            tickFormatter={(v: number) => n(v)}
            stroke={ink.light.muted}
            fontSize={12}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => n(v)}
            stroke={ink.light.muted}
            fontSize={12}
            tickLine={false}
            width={48}
          />
          <Tooltip
            formatter={(value: number) => [n(value), t('dailyDosesTitle')]}
            labelFormatter={(dayIndex: number) => {
              const p = data[dayIndex - 1]
              return p ? formatDate(p.date, lang) : ''
            }}
          />
          <Bar dataKey="doses" fill={sequentialBlue[450]} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
