import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string
  subtext?: string
  icon: LucideIcon
  variant?: 'default' | 'income' | 'expense' | 'tax' | 'takehome'
}

const variants = {
  default: 'from-slate-800 to-slate-900 border-slate-700',
  income: 'from-emerald-900/40 to-slate-900 border-emerald-800/50',
  expense: 'from-orange-900/30 to-slate-900 border-orange-800/40',
  tax: 'from-amber-900/30 to-slate-900 border-amber-800/40',
  takehome: 'from-sky-900/30 to-slate-900 border-sky-800/40',
}

const iconVariants = {
  default: 'text-slate-400 bg-slate-800',
  income: 'text-emerald-400 bg-emerald-950',
  expense: 'text-orange-400 bg-orange-950',
  tax: 'text-amber-400 bg-amber-950',
  takehome: 'text-sky-400 bg-sky-950',
}

export function StatCard({ label, value, subtext, icon: Icon, variant = 'default' }: StatCardProps) {
  return (
    <div
      className={`rounded-2xl border bg-gradient-to-br p-4 ${variants[variant]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-bold text-white truncate">{value}</p>
          {subtext && <p className="mt-1 text-xs text-slate-500">{subtext}</p>}
        </div>
        <div className={`shrink-0 p-2.5 rounded-xl ${iconVariants[variant]}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  )
}
