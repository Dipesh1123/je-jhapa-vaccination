import { FileSpreadsheet, Clock } from 'lucide-react'
import { useLang } from '../lib/i18n'

export function Downloads() {
  const { t } = useLang()

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">{t('downloadsTitle')}</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {t('downloadsSubtitle')}
        </p>
      </div>

      <a
        href="/api/export-aggregate"
        className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all"
      >
        <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
          <FileSpreadsheet size={20} />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-800">{t('wardAggregateTitle')}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('wardAggregateDesc')}
          </p>
        </div>
      </a>

      <div className="flex items-center gap-3 bg-slate-50 rounded-xl border border-slate-200 border-dashed p-4">
        <div className="h-10 w-10 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
          <Clock size={20} />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">{t('excelMirrorTitle')}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {t('excelMirrorDesc')}
          </p>
        </div>
      </div>
    </div>
  )
}
