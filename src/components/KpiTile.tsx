import type { LucideIcon } from 'lucide-react'
import { cn } from '../lib/utils'

// Per the dataviz skill: a single number has no shape to plot, so these are
// stat tiles, not charts. The icon + colored bg pairing here is the house
// pattern from school-health-nurse's AdminDashboard KPI cards.

const HUE = {
  blue: { text: 'text-blue-600', bg: 'bg-blue-50' },
  green: { text: 'text-green-600', bg: 'bg-green-50' },
  amber: { text: 'text-amber-600', bg: 'bg-amber-50' },
  purple: { text: 'text-purple-600', bg: 'bg-purple-50' },
  red: { text: 'text-red-600', bg: 'bg-red-50' },
} as const

interface KpiTileProps {
  icon: LucideIcon
  label: string
  value: string
  hue: keyof typeof HUE
  sublabel?: string
}

export function KpiTile({ icon: Icon, label, value, hue, sublabel }: KpiTileProps) {
  const { text, bg } = HUE[hue]
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3">
      <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', bg, text)}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 leading-tight">{label}</p>
        <p className="text-xl font-semibold text-slate-800 leading-tight mt-0.5" style={{ fontVariantNumeric: 'proportional-nums' }}>
          {value}
        </p>
        {sublabel && <p className="text-xs text-slate-400 mt-0.5">{sublabel}</p>}
      </div>
    </div>
  )
}
