import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api, type PalikaDetail } from '../lib/api'
import { formatNumeral } from '../lib/nepali'
import { useLang } from '../lib/i18n'
import { WardTable } from '../components/WardTable'
import { ErrorBanner } from '../components/ErrorBanner'
import { Spinner } from '../components/Spinner'

export function Palika() {
  const { lang, t } = useLang()
  const n = (v: number | string) => formatNumeral(v, lang)
  const { code } = useParams<{ code: string }>()
  const [data, setData] = useState<PalikaDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!code) return
    setData(null)
    api.palika(code).then(setData).catch((e) => setError(String(e)))
  }, [code])

  if (error) return <div className="p-6"><ErrorBanner message={error} /></div>
  if (!data) return <div className="p-6"><Spinner /></div>

  const { palika, wards } = data

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:underline">
        <ArrowLeft size={16} /> {t('backToDashboard')}
      </Link>

      <div>
        <h1 className="text-lg font-semibold text-slate-800">{palika.local_level_name}</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {t('wardsReported', { a: n(palika.wards_reporting), b: n(palika.ward_count) })} ·
          {' '}{t('colPopulation')} {n(palika.population.toLocaleString())} ·
          {' '}{t('target')} {n(Math.round(palika.je_target).toLocaleString())}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <h3 className="text-sm font-semibold text-slate-700 px-4 pt-4 pb-2">{t('progressByWard')}</h3>
        <WardTable wards={wards} />
      </div>
    </div>
  )
}
