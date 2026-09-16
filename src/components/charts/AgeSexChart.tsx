import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList, ResponsiveContainer,
} from 'recharts'
import type { AgeSexRow } from '../../lib/api'
import { categorical, ink } from '../../lib/palette'
import { formatNumeral } from '../../lib/nepali'
import { useLang } from '../../lib/i18n'

interface Props {
  ageSex: AgeSexRow[]
}

// Sex is the color (2 series, slots 1-2 - both clear 3:1 contrast outright,
// no relief rule needed), age band is the x-axis category. This keeps a
// consistent color per sex across both bands - color follows the entity,
// never its position - rather than 4 hues that would make "female" a
// different color in each age group.
const FEMALE = categorical.light[0]
const MALE = categorical.light[1]

function buildData(ageSex: AgeSexRow[], band3060: string, band60plus: string) {
  const find = (band: string, sex: string) =>
    ageSex.find((r) => r.age_band === band && r.sex === sex)?.doses ?? 0

  return [
    { band: 'age_30_60', label: band3060, female: find('age_30_60', 'female'), male: find('age_30_60', 'male') },
    { band: 'age_60_plus', label: band60plus, female: find('age_60_plus', 'female'), male: find('age_60_plus', 'male') },
  ]
}

export function AgeSexChart({ ageSex }: Props) {
  const { lang, t } = useLang()
  const n = (v: number) => formatNumeral(v, lang)
  const data = buildData(ageSex, t('ageBand3060'), t('ageBand60plus'))

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('ageSexTitle')}</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 16, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={ink.light.gridline} vertical={false} />
          <XAxis dataKey="label" stroke={ink.light.muted} fontSize={12} tickLine={false} />
          <YAxis
            tickFormatter={(v: number) => n(v)}
            stroke={ink.light.muted}
            fontSize={12}
            tickLine={false}
            width={48}
          />
          <Tooltip formatter={(v: number) => n(v)} />
          <Legend formatter={(value: string) => (value === 'female' ? t('female') : t('male'))} />
          <Bar dataKey="female" stackId="sex" fill={FEMALE} name="female" radius={[0, 0, 4, 4]}>
            <LabelList dataKey="female" position="center" fill="#fff" fontSize={12}
              formatter={(v: number) => (v > 0 ? n(v) : '')} />
          </Bar>
          <Bar dataKey="male" stackId="sex" fill={MALE} name="male" radius={[4, 4, 0, 0]}>
            <LabelList dataKey="male" position="center" fill="#fff" fontSize={12}
              formatter={(v: number) => (v > 0 ? n(v) : '')} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
