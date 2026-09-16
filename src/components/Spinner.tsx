import { Loader2 } from 'lucide-react'

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-12 text-slate-400">
      <Loader2 size={24} className="animate-spin" />
    </div>
  )
}
