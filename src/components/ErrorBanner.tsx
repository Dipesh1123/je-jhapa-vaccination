import { AlertTriangle } from 'lucide-react'

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start gap-2">
      <AlertTriangle size={16} className="text-red-600 mt-0.5 shrink-0" />
      <p className="text-sm text-red-700">{message}</p>
    </div>
  )
}
