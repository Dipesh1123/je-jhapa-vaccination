import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpDown } from 'lucide-react'
import type { PalikaRow } from '../lib/api'
import { sequentialBlue } from '../lib/palette'
import { formatNumeral } from '../lib/nepali'
import { useLang, type TranslationKey } from '../lib/i18n'

interface Props {
  palikas: PalikaRow[]
}

type SortKey = 'coverage_pct' | 'total_doses' | 'population' | 'local_level_name'

// Bar length here encodes coverage % - a magnitude, not an identity - so it
// is a single sequential hue, never one categorical color per row.
const BAR_COLOR = sequentialBlue[450]

export function PalikaLeagueTable({ palikas }: Props) {
  const { lang, t } = useLang()
  const n = (v: number | string) => formatNumeral(v, lang)
  const [sortKey, setSortKey] = useState<SortKey>('coverage_pct')
  const [desc, setDesc] = useState(true)

  const sorted = [...palikas].sort((a, b) => {
    const av = a[sortKey]
    const bv = b[sortKey]
    const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : Number(av) - Number(bv)
    return desc ? -cmp : cmp
  })

  function toggleSort(key: SortKey) {
    if (key === sortKey) setDesc((d) => !d)
    else { setSortKey(key); setDesc(true) }
  }

  const headers: { key: SortKey; labelKey: TranslationKey }[] = [
    { key: 'local_level_name', labelKey: 'colLocalLevel' },
    { key: 'population', labelKey: 'colPopulation' },
    { key: 'total_doses', labelKey: 'colVaccinated' },
    { key: 'coverage_pct', labelKey: 'colProgress' },
  ]

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <h3 className="text-sm font-semibold text-slate-700 px-4 pt-4 pb-2">
        {t('progressByLocalLevel')}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              {headers.map((h) => (
                <th
                  key={h.key}
                  onClick={() => toggleSort(h.key)}
                  className="text-left px-4 py-2 text-xs font-medium text-slate-500 cursor-pointer select-none hover:text-slate-700 whitespace-nowrap"
                >
                  <span className="inline-flex items-center gap-1">
                    {t(h.labelKey)}
                    <ArrowUpDown size={12} className={sortKey === h.key ? 'text-blue-600' : 'text-slate-300'} />
                  </span>
                </th>
              ))}
              <th className="w-32" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.local_level_code} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                <td className="px-4 py-2.5">
                  <Link to={`/palika/${p.local_level_code}`} className="text-blue-700 hover:underline font-medium">
                    {p.local_level_name}
                  </Link>
                  <span className="text-xs text-slate-400 block">
                    {t('wardsReported', { a: n(p.wards_reporting), b: n(p.ward_count) })}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-600" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {n(p.population.toLocaleString())}
                </td>
                <td className="px-4 py-2.5 text-slate-600" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {n(p.total_doses.toLocaleString())}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden min-w-16">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(p.coverage_pct, 100)}%`,
                          backgroundColor: BAR_COLOR,
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-700 tabular-nums w-12 text-right">
                      {n(p.coverage_pct.toFixed(1))}%
                    </span>
                  </div>
                </td>
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
