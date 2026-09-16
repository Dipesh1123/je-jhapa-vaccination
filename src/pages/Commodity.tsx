import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, AlertTriangle, PackageX, TrendingDown } from 'lucide-react'
import { api, type CommodityRow } from '../lib/api'
import { formatNumeral, formatDate } from '../lib/nepali'
import { status } from '../lib/palette'
import { useLang, type TranslationKey } from '../lib/i18n'
import { KpiTile } from '../components/KpiTile'
import { ErrorBanner } from '../components/ErrorBanner'
import { Spinner } from '../components/Spinner'

// Stock/wastage status - always icon + label, never color alone (status
// colors are reserved and never reused as a series color elsewhere).
function stockStatus(row: CommodityRow): { labelKey: TranslationKey; color: string; Icon: typeof AlertCircle } {
  if ((row.vaccine_closing ?? 0) === 0) {
    return { labelKey: 'statusOutOfStock', color: status.critical, Icon: AlertCircle }
  }
  if ((row.wastage_pct ?? 0) > 20) {
    return { labelKey: 'statusHighWastage', color: status.warning, Icon: AlertTriangle }
  }
  return { labelKey: 'statusNormal', color: status.good, Icon: CheckCircle2 }
}

export function Commodity() {
  const { lang, t } = useLang()
  const n = (v: number | string) => formatNumeral(v, lang)
  const [rows, setRows] = useState<CommodityRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.commodity().then((d) => setRows(d.rows)).catch((e) => setError(String(e)))
  }, [])

  if (error) return <div className="p-6"><ErrorBanner message={error} /></div>
  if (!rows) return <div className="p-6"><Spinner /></div>

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">{t('commodityTitle')}</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {t('commoditySubtitle', { n: n(rows.length) })}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-400">
          {t('noReportsYet')}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <KpiTile icon={PackageX} hue="red" label={t('kpiOutOfStock')}
              value={n(rows.filter((r) => (r.vaccine_closing ?? 0) === 0).length)} />
            <KpiTile icon={AlertTriangle} hue="amber" label={t('kpiHighWastage')}
              value={n(rows.filter((r) => (r.wastage_pct ?? 0) > 20).length)} />
            <KpiTile icon={TrendingDown} hue="blue" label={t('kpiAvgWastage')}
              value={`${n((rows.reduce((sum, r) => sum + (r.wastage_pct ?? 0), 0) / rows.length).toFixed(1))}%`} />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-medium text-slate-500">
                  <th className="text-left px-4 py-2">{t('colLocalLevelWard')}</th>
                  <th className="text-left px-4 py-2">{t('colVaccineStock')}</th>
                  <th className="text-left px-4 py-2">{t('colDiluent')}</th>
                  <th className="text-left px-4 py-2">{t('colSyringe')}</th>
                  <th className="text-left px-4 py-2">{t('colSafetyBox')}</th>
                  <th className="text-left px-4 py-2">{t('colWastageRate')}</th>
                  <th className="text-left px-4 py-2">{t('colStatus')}</th>
                  <th className="text-left px-4 py-2">{t('colDate')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const s = stockStatus(r)
                  return (
                    <tr key={r.ward_code} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-2.5">
                        <span className="font-medium text-slate-700">{r.local_level_name}</span>
                        <span className="text-slate-400"> {t('wardLabel', { n: n(r.ward_no) })}</span>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-slate-600">{n(r.vaccine_closing ?? 0)}</td>
                      <td className="px-4 py-2.5 tabular-nums text-slate-600">{n(r.diluent_closing ?? 0)}</td>
                      <td className="px-4 py-2.5 tabular-nums text-slate-600">{n(r.ad_syr_closing ?? 0)}</td>
                      <td className="px-4 py-2.5 tabular-nums text-slate-600">{n(r.safety_box_closing ?? 0)}</td>
                      <td className="px-4 py-2.5 tabular-nums text-slate-600">
                        {r.wastage_pct != null ? `${n(r.wastage_pct.toFixed(1))}%` : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: `${s.color}1a`, color: s.color }}
                        >
                          <s.Icon size={12} />
                          {t(s.labelKey)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">
                        {r.stock_as_of ? formatDate(r.stock_as_of, lang) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          </div>
        </>
      )}
    </div>
  )
}
