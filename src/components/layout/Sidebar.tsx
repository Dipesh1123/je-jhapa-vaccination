import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Map, Package, Download, X } from 'lucide-react'
import { cn } from '../../lib/utils'

interface SidebarProps {
  onClose?: () => void
}

const links = [
  { to: '/', icon: LayoutDashboard, label: 'ड्यासबोर्ड', end: true },
  { to: '/map', icon: Map, label: 'नक्सा' },
  { to: '/commodity', icon: Package, label: 'सामग्री मौज्दात' },
  { to: '/downloads', icon: Download, label: 'डाउनलोड' },
]

export function Sidebar({ onClose }: SidebarProps) {
  return (
    <aside className="w-64 md:w-60 bg-white border-r border-slate-200 flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-100">
        <p className="text-xs font-semibold text-govt-navy leading-tight tracking-wide uppercase">
          मुख्य मेनु
        </p>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-govt-navy'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-slate-100">
        <p className="text-xs text-slate-400 leading-relaxed">
          आ.व. २०८३/८४ · सार्वजनिक डेटा
        </p>
      </div>
    </aside>
  )
}
