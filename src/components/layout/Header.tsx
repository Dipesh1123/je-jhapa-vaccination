import { Menu } from 'lucide-react'
import { formatBsDate } from '../../lib/nepali'

interface HeaderProps {
  onMenuClick?: () => void
}

// Two-tier government letterhead masthead - the same pattern used across
// the sibling Health Office projects (ACTION PLAN 2083-84, VBD
// Surveillance): a thin flag strip, a dark utility bar with date/FY, and a
// white brand bar with the government emblem, ministry hierarchy and title.
export function Header({ onMenuClick }: HeaderProps) {
  const today = new Date().toISOString().slice(0, 10)

  return (
    <header className="relative z-20 shrink-0">
      <div className="h-[5px] bg-govt-crimson" />

      <div className="bg-govt-navy-dark text-blue-100/80 text-[11px] md:text-xs px-4 md:px-6 py-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5">
        <span>{formatBsDate(today)} · आ.व. २०८३/८४</span>
        <span className="hidden sm:inline">५–१९ असोज २०८३ अभियान · सार्वजनिक ड्यासबोर्ड</span>
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
          alt="नेपाल सरकारको निशान"
          className="h-11 w-11 md:h-14 md:w-14 object-contain shrink-0"
        />
        <div className="min-w-0">
          <p className="text-[11px] md:text-xs font-semibold text-govt-maroon leading-tight truncate">
            नेपाल सरकार · कोशी प्रदेश सरकार, स्वास्थ्य मन्त्रालय
          </p>
          <h1 className="text-sm md:text-xl font-bold text-govt-navy leading-tight truncate">
            स्वास्थ्य कार्यालय, झापा — जे.ई. खोप अभियान प्रगति
          </h1>
          <p className="text-[11px] md:text-xs text-slate-500 leading-tight truncate">
            जापानिज इन्सेफ्लाइटिस खोप अभियान ड्यासबोर्ड · आ.व. २०८३/८४
          </p>
        </div>
      </div>
    </header>
  )
}
