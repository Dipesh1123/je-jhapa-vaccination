import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react'
import { api, type CommodityRow } from '../lib/api'
import { toNepaliNumeral, formatBsDate } from '../lib/nepali'
import { status } from '../lib/palette'
import { ErrorBanner } from '../components/ErrorBanner'
import { Spinner } from '../components/Spinner'

// Stock/wastage status - always icon + label, never color alone (status
// colors are reserved and never reused as a series color elsewhere).
function stockStatus(row: CommodityRow) {
  if ((row.vaccine_closing ?? 0) === 0) {
    return { label: 'स्टक सकियो', color: status.critical, Icon: AlertCircle }
  }
  if ((row.wastage_pct ?? 0) > 20) {
    return { label: 'उच्च खेर (>२०%)', color: status.warning, Icon: AlertTriangle }
  }
  return { label: 'सामान्य', color: status.good, Icon: CheckCircle2 }
}

export function Commodity() {
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
        <h1 className="text-lg font-semibold text-slate-800">सामग्री मौज्दात र खेर</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          अन्तिम प्रतिवेदन अनुसार वडागत मौज्दात — {toNepaliNumeral(rows.length)} वडाले प्रतिवेदन गरेको
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-400">
          अझै कुनै प्रतिवेदन प्राप्त भएको छैन
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-medium text-slate-500">
                  <th className="text-left px-4 py-2">स्थानीय तह / वडा</th>
                  <th className="text-left px-4 py-2">खोप मौज्दात</th>
                  <th className="text-left px-4 py-2">डाइलुएन्ट</th>
                  <th className="text-left px-4 py-2">सिरिन्ज (AD)</th>
                  <th className="text-left px-4 py-2">सेफ्टी बक्स</th>
                  <th className="text-left px-4 py-2">खेर दर</th>
                  <th className="text-left px-4 py-2">अवस्था</th>
                  <th className="text-left px-4 py-2">मिति</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const s = stockStatus(r)
                  return (
                    <tr key={r.ward_code} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-2.5">
                        <span className="font-medium text-slate-700">{r.local_level_name}</span>
                        <span className="text-slate-400"> · वडा {toNepaliNumeral(r.ward_no)}</span>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-slate-600">{toNepaliNumeral(r.vaccine_closing ?? 0)}</td>
                      <td className="px-4 py-2.5 tabular-nums text-slate-600">{toNepaliNumeral(r.diluent_closing ?? 0)}</td>
                      <td className="px-4 py-2.5 tabular-nums text-slate-600">{toNepaliNumeral(r.ad_syr_closing ?? 0)}</td>
                      <td className="px-4 py-2.5 tabular-nums text-slate-600">{toNepaliNumeral(r.safety_box_closing ?? 0)}</td>
                      <td className="px-4 py-2.5 tabular-nums text-slate-600">
                        {r.wastage_pct != null ? `${toNepaliNumeral(r.wastage_pct.toFixed(1))}%` : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: `${s.color}1a`, color: s.color }}
                        >
                          <s.Icon size={12} />
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">
                        {r.stock_as_of ? formatBsDate(r.stock_as_of) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
