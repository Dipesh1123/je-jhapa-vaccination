import { Menu } from 'lucide-react'
import { formatDate } from '../../lib/nepali'
import { useLang } from '../../lib/i18n'

interface HeaderProps {
  onMenuClick?: () => void
}

// Two-tier government letterhead masthead - the same pattern used across
// the sibling Health Office projects (ACTION PLAN 2083-84, VBD
// Surveillance): a thin flag strip, a dark utility bar with date/FY, and a
// white brand bar with the government emblem, ministry hierarchy and title.
export function Header({ onMenuClick }: HeaderProps) {
  const { lang, setLang, t } = useLang()
  const today = new Date().toISOString().slice(0, 10)

  return (
    <header className="relative z-20 shrink-0">
      <div className="h-[5px] bg-govt-crimson" />

      <div className="bg-govt-navy-dark text-blue-100/80 text-[11px] md:text-xs px-4 md:px-6 py-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5">
        <span>{formatDate(today, lang)} · {t('fiscalYear')}</span>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline">{t('campaignWindow')}</span>
          <LangToggle lang={lang} setLang={setLang} />
        </div>
      </div>

      <div className="bg-white border-b-[3px] border-govt-gold px-4 md:px-6 py-3 flex items-center gap-3 md:gap-4">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="md:hidden p-1.5 -ml-1 rounded-lg text-slate-600 hover:bg-slate-100 shrink-0"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
        )}
        <img
          src="/logo.png"
          alt="Emblem of Nepal"
          className="h-11 w-11 md:h-14 md:w-14 object-contain shrink-0"
        />
        <div className="min-w-0">
          <p className="text-[11px] md:text-xs font-semibold text-govt-maroon leading-tight truncate">
            {t('govtLine')}
          </p>
          <h1 className="text-sm md:text-xl font-bold text-govt-navy leading-tight truncate">
            {t('officeTitle')}
          </h1>
          <p className="text-[11px] md:text-xs text-slate-500 leading-tight truncate">
            {t('campaignSubtitle')} · {t('fiscalYear')}
          </p>
        </div>
      </div>
    </header>
  )
}

function LangToggle({ lang, setLang }: { lang: 'en' | 'ne'; setLang: (l: 'en' | 'ne') => void }) {
  return (
    <div className="flex items-center rounded-full bg-white/10 p-0.5 text-[10px] font-semibold shrink-0" role="group" aria-label="Language">
      <button
        onClick={() => setLang('en')}
        className={`px-2 py-0.5 rounded-full transition-colors ${lang === 'en' ? 'bg-white text-govt-navy-dark' : 'text-blue-100/80 hover:text-white'}`}
        aria-pressed={lang === 'en'}
      >
        EN
      </button>
      <button
        onClick={() => setLang('ne')}
        className={`px-2 py-0.5 rounded-full transition-colors ${lang === 'ne' ? 'bg-white text-govt-navy-dark' : 'text-blue-100/80 hover:text-white'}`}
        aria-pressed={lang === 'ne'}
      >
        ने
      </button>
    </div>
  )
}
