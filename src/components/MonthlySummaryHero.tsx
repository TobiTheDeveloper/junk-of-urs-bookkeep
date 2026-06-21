import { PiggyBank, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { formatCurrency } from '../lib/format'

interface MonthlySummaryHeroProps {
  monthName: string
  currency: string
  income: number
  expenses: number
  taxReserve: number
  takeHome: number
  taxRatePercent: number
}

export function MonthlySummaryHero({
  monthName,
  currency,
  income,
  expenses,
  taxReserve,
  takeHome,
  taxRatePercent,
}: MonthlySummaryHeroProps) {
  const metrics = [
    {
      label: 'Income',
      value: formatCurrency(income, currency),
      icon: TrendingUp,
      valueClass: 'text-emerald-400',
      iconClass: 'text-emerald-400 bg-emerald-950/80',
    },
    {
      label: 'Expenses',
      value: formatCurrency(expenses, currency),
      icon: TrendingDown,
      valueClass: 'text-orange-400',
      iconClass: 'text-orange-400 bg-orange-950/80',
    },
    {
      label: 'Tax set-aside',
      value: formatCurrency(taxReserve, currency),
      icon: PiggyBank,
      valueClass: 'text-amber-400',
      iconClass: 'text-amber-400 bg-amber-950/80',
    },
  ] as const

  return (
    <section className="rounded-2xl border border-sky-800/40 bg-gradient-to-br from-sky-950/50 via-slate-900 to-slate-900 overflow-hidden">
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-sky-300/80">
              Estimated take-home · {monthName}
            </p>
            <p className="mt-1 text-[clamp(2rem,9vw,3rem)] font-bold leading-none text-white tabular-nums tracking-tight break-words">
              {formatCurrency(takeHome, currency)}
            </p>
            <p className="mt-2 text-xs text-slate-400">After expenses & tax reserve</p>
          </div>
          <div className="shrink-0 rounded-xl bg-sky-950/80 p-2.5 text-sky-400">
            <Wallet size={22} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 divide-y divide-slate-800/80 border-t border-slate-800/80 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {metrics.map(({ label, value, icon: Icon, valueClass, iconClass }) => (
          <div key={label} className="flex items-center gap-3 px-4 py-3.5 sm:flex-col sm:items-start sm:gap-2 sm:py-4">
            <div className={`shrink-0 rounded-lg p-2 ${iconClass}`}>
              <Icon size={16} />
            </div>
            <div className="min-w-0 flex-1 sm:w-full">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
              <p
                className={`mt-0.5 text-xl font-bold tabular-nums leading-tight sm:text-lg ${valueClass}`}
              >
                {value}
              </p>
              {label === 'Tax set-aside' && (
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {taxRatePercent.toFixed(0)}% of net profit
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
