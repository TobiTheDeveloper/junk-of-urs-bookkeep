import { useMemo, useState } from 'react'
import { Briefcase, Truck, FileSpreadsheet } from 'lucide-react'
import { GhostButton } from '../components/FormFields'
import { useCategories, useSettings, useTransactions } from '../hooks/useData'
import { calculateSummary } from '../lib/calculations'
import { normalizeCategoryName } from '../lib/dedupe'
import { exportCategoryBreakdownCsv, exportSummaryCsv } from '../lib/export'
import { formatCurrency, getMonthLabel } from '../lib/format'
import { formatDueDate, getQuarterlyReminders } from '../lib/taxReminders'

export function ReportsPage() {
  const transactions = useTransactions()
  const categories = useCategories()
  const settings = useSettings()

  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>(now.getMonth() + 1)

  const years = useMemo(() => {
    const set = new Set(transactions.map((t) => new Date(t.date + 'T12:00:00').getFullYear()))
    set.add(now.getFullYear())
    return Array.from(set).sort((a, b) => b - a)
  }, [transactions])

  const summary = useMemo(() => {
    if (!settings) return null
    const month = selectedMonth === 'all' ? undefined : selectedMonth
    return calculateSummary(transactions, categories, settings, selectedYear, month)
  }, [transactions, categories, settings, selectedYear, selectedMonth])

  const currency = settings?.currency ?? 'USD'

  if (!settings || !summary) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  const periodLabel =
    selectedMonth === 'all'
      ? `${selectedYear} (Full Year)`
      : getMonthLabel(selectedYear, selectedMonth as number)

  const topCategories = Array.from(
    Object.entries(summary.expenseByCategory).reduce(
      (acc, [catId, amount]) => {
        const cat = categories.find((c) => c.id === catId)
        const name = cat?.name ?? 'Uncategorized'
        const key = normalizeCategoryName(name)
        const existing = acc.get(key)
        if (existing) {
          existing.amount += amount
        } else {
          acc.set(key, {
            name,
            color: cat?.color ?? '#64748b',
            amount,
          })
        }
        return acc
      },
      new Map<string, { name: string; color: string; amount: number }>(),
    ).values(),
  ).sort((a, b) => b.amount - a.amount)

  const maxCategoryAmount = topCategories[0]?.amount ?? 1

  const quarterReminders = getQuarterlyReminders(transactions, categories, settings)

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports</h1>
          <p className="text-sm text-slate-400 mt-0.5">Profit, taxes, and spending breakdown</p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <GhostButton
            type="button"
            onClick={() => exportSummaryCsv(summary, periodLabel, settings.businessName, currency)}
            className="text-xs px-3 py-2 flex items-center gap-1.5"
          >
            <FileSpreadsheet size={14} />
            Summary CSV
          </GhostButton>
          <GhostButton
            type="button"
            onClick={() =>
              exportCategoryBreakdownCsv(
                summary,
                categories,
                periodLabel,
                settings.businessName,
                currency,
              )
            }
            className="text-xs px-3 py-2 flex items-center gap-1.5"
          >
            <FileSpreadsheet size={14} />
            Categories CSV
          </GhostButton>
        </div>
      </header>

      <div className="flex gap-2">
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-white"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select
          value={selectedMonth}
          onChange={(e) =>
            setSelectedMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))
          }
          className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-white"
        >
          <option value="all">Full Year</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {getMonthLabel(selectedYear, m).split(' ')[0]}
            </option>
          ))}
        </select>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">{periodLabel} Summary</h2>
        <div className="space-y-3">
          <Row label="Gross Income" value={summary.grossIncome} currency={currency} positive />
          <Row label="Total Expenses" value={summary.totalExpenses} currency={currency} negative />
          <Row
            label="Deductible Expenses"
            value={summary.deductibleExpenses}
            currency={currency}
            muted
          />
          <div className="border-t border-slate-800 pt-3">
            <Row label="Net Profit (taxable)" value={summary.netProfit} currency={currency} bold />
          </div>
          <Row
            label={`Tax Reserve (CRA 2026 · ${summary.effectiveTaxRate.toFixed(1)}%)`}
            value={summary.taxReserve}
            currency={currency}
            accent="amber"
          />
          <Row
            label="Federal income tax"
            value={summary.taxBreakdown.federalIncomeTax}
            currency={currency}
            muted
          />
          <Row
            label="Ontario income tax"
            value={summary.taxBreakdown.ontarioIncomeTax}
            currency={currency}
            muted
          />
          {summary.taxBreakdown.ontarioHealthPremium > 0 && (
            <Row
              label="Ontario Health Premium"
              value={summary.taxBreakdown.ontarioHealthPremium}
              currency={currency}
              muted
            />
          )}
          <Row
            label="CPP contributions"
            value={summary.taxBreakdown.cppContributions}
            currency={currency}
            muted
          />
          <div className="border-t border-slate-800 pt-3">
            <Row label="Estimated Take-Home" value={summary.takeHome} currency={currency} bold accent="sky" />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Income Breakdown</h2>
        <div className="space-y-3">
          <IncomeBar
            label="Subcontractor Work"
            amount={summary.subcontractorIncome}
            total={summary.grossIncome}
            currency={currency}
            icon={Briefcase}
            color="#818cf8"
          />
          <IncomeBar
            label="Junk Removal"
            amount={summary.junkRemovalIncome}
            total={summary.grossIncome}
            currency={currency}
            icon={Truck}
            color="#a3e635"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Expenses by Category</h2>
        {topCategories.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">No expenses in this period</p>
        ) : (
          <div className="space-y-3">
            {topCategories.map((cat) => (
              <div key={cat.name}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-300">{cat.name}</span>
                  <span className="font-semibold text-white">
                    {formatCurrency(cat.amount, currency)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(cat.amount / maxCategoryAmount) * 100}%`,
                      backgroundColor: cat.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">
          Quarterly Estimated Tax Schedule ({selectedYear})
        </h2>
        <div className="space-y-3">
          {quarterReminders.map((q) => (
            <div
              key={q.key}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-800/40 px-3 py-2.5"
            >
              <div>
                <p className="text-sm font-medium text-white">{q.label}</p>
                <p className="text-xs text-slate-500">Due {formatDueDate(q.dueDate)}</p>
              </div>
              <span className="font-semibold text-amber-400 shrink-0">
                {formatCurrency(q.estimatedPayment, currency)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function Row({
  label,
  value,
  currency,
  positive,
  negative,
  muted,
  bold,
  accent,
}: {
  label: string
  value: number
  currency: string
  positive?: boolean
  negative?: boolean
  muted?: boolean
  bold?: boolean
  accent?: 'amber' | 'sky'
}) {
  let color = 'text-white'
  if (positive) color = 'text-emerald-400'
  if (negative) color = 'text-orange-400'
  if (muted) color = 'text-slate-400'
  if (accent === 'amber') color = 'text-amber-400'
  if (accent === 'sky') color = 'text-sky-400'

  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${muted ? 'text-slate-500' : 'text-slate-300'}`}>{label}</span>
      <span className={`${bold ? 'font-bold text-base' : 'font-semibold text-sm'} ${color}`}>
        {formatCurrency(value, currency)}
      </span>
    </div>
  )
}

function IncomeBar({
  label,
  amount,
  total,
  currency,
  icon: Icon,
  color,
}: {
  label: string
  amount: number
  total: number
  currency: string
  icon: typeof Briefcase
  color: string
}) {
  const pct = total > 0 ? (amount / total) * 100 : 0

  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <div className="flex items-center gap-2 text-slate-300">
          <Icon size={14} style={{ color }} />
          {label}
        </div>
        <span className="font-semibold text-white">{formatCurrency(amount, currency)}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <p className="text-xs text-slate-500 mt-0.5">{pct.toFixed(0)}% of income</p>
    </div>
  )
}
