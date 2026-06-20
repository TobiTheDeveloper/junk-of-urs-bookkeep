import { useEffect, useMemo } from 'react'
import {
  DollarSign,
  PiggyBank,
  Briefcase,
  Truck,
} from 'lucide-react'
import { AmountRow } from '../components/AmountRow'
import { MonthlySummaryHero } from '../components/MonthlySummaryHero'
import { TaxReminderBanner } from '../components/TaxReminderBanner'
import { formatCurrency, formatShortDate } from '../lib/format'
import { calculateSummary } from '../lib/calculations'
import {
  getActiveQuarterlyReminder,
  getQuarterlyReminders,
  maybeShowTaxNotification,
  requestNotificationPermission,
} from '../lib/taxReminders'
import {
  dismissQuarterlyReminder,
  useCategories,
  useSettings,
  useTransactions,
} from '../hooks/useData'

export function Dashboard() {
  const transactions = useTransactions()
  const categories = useCategories()
  const settings = useSettings()

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const summary = useMemo(() => {
    if (!settings) return null
    return calculateSummary(transactions, categories, settings, year, month)
  }, [transactions, categories, settings, year, month])

  const yearSummary = useMemo(() => {
    if (!settings) return null
    return calculateSummary(transactions, categories, settings, year)
  }, [transactions, categories, settings, year])

  const activeReminder = useMemo(() => {
    if (!settings) return null
    return getActiveQuarterlyReminder(transactions, categories, settings)
  }, [transactions, categories, settings])

  const allQuarterReminders = useMemo(() => {
    if (!settings) return []
    return getQuarterlyReminders(transactions, categories, settings)
  }, [transactions, categories, settings])

  useEffect(() => {
    if (!settings || !activeReminder) return
    if (Notification.permission !== 'granted') return
    maybeShowTaxNotification(activeReminder, settings.businessName)
  }, [activeReminder, settings])

  const recent = transactions.slice(0, 5)
  const currency = settings?.currency ?? 'USD'
  const notificationsSupported = 'Notification' in window

  if (!settings || !summary || !yearSummary) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(now)

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-brand-400 font-medium">{settings.businessName}</p>
        <h1 className="text-2xl font-bold text-white mt-0.5">{monthName} Overview</h1>
        <p className="text-sm text-slate-400 mt-1">Solo proprietorship · {year}</p>
      </header>

      {activeReminder && (
        <TaxReminderBanner
          reminder={activeReminder}
          currency={currency}
          onDismiss={() => dismissQuarterlyReminder(activeReminder.key)}
          notificationsSupported={notificationsSupported}
          onEnableNotifications={async () => {
            const granted = await requestNotificationPermission()
            if (granted && activeReminder) {
              maybeShowTaxNotification(activeReminder, settings.businessName)
            }
          }}
        />
      )}

      <MonthlySummaryHero
        monthName={monthName}
        currency={currency}
        income={summary.grossIncome}
        expenses={summary.totalExpenses}
        taxReserve={summary.taxReserve}
        takeHome={summary.takeHome}
        taxRatePercent={summary.effectiveTaxRate}
      />

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Income by Source (this month)</h2>
        <div className="space-y-3">
          <AmountRow
            label={
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <Briefcase size={16} className="shrink-0 text-indigo-400" />
                <span>Subcontractor Work</span>
              </div>
            }
            amount={formatCurrency(summary.subcontractorIncome, currency)}
          />
          <AmountRow
            label={
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <Truck size={16} className="shrink-0 text-lime-400" />
                <span>Junk Removal</span>
              </div>
            }
            amount={formatCurrency(summary.junkRemovalIncome, currency)}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-amber-900/40 bg-amber-950/20 p-4">
        <div className="flex items-start gap-3">
          <PiggyBank size={20} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-amber-200">Tax Reserve Reminder</h2>
            <p className="text-sm text-amber-100/70 mt-1">
              As a solo proprietorship, set aside{' '}
              <strong className="text-amber-200 tabular-nums">
                {formatCurrency(yearSummary.taxReserve, currency)}
              </strong>{' '}
              for taxes on your {year} net profit of{' '}
              <span className="tabular-nums">{formatCurrency(yearSummary.netProfit, currency)}</span>.
              Adjust rates in Settings.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">
          Estimated Quarterly Payments ({year})
        </h2>
        <div className="space-y-2">
          {allQuarterReminders.map((q) => (
            <AmountRow
              key={q.key}
              label={<span className="text-sm text-slate-400">{q.label}</span>}
              amount={formatCurrency(q.estimatedPayment, currency)}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Recent Activity</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">
            No transactions yet. Add income or an expense to get started.
          </p>
        ) : (
          <div className="space-y-2">
            {recent.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">
                    {tx.description || (tx.type === 'income' ? 'Income' : 'Expense')}
                  </p>
                  <p className="text-xs text-slate-500">{formatShortDate(tx.date)}</p>
                </div>
                <span
                  className={`shrink-0 text-base font-bold tabular-nums sm:text-sm ${
                    tx.type === 'income' ? 'text-emerald-400' : 'text-orange-400'
                  }`}
                >
                  {tx.type === 'income' ? '+' : '-'}
                  {formatCurrency(tx.amount, currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign size={16} className="text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-300">Year-to-Date ({year})</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-2">
          <div className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2.5 sm:block sm:border-0 sm:bg-transparent sm:p-0 sm:text-center">
            <p className="text-xs text-slate-500 sm:mb-1">Income</p>
            <p className="text-lg font-bold text-emerald-400 tabular-nums sm:text-sm">
              {formatCurrency(yearSummary.grossIncome, currency)}
            </p>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2.5 sm:block sm:border-0 sm:bg-transparent sm:p-0 sm:text-center">
            <p className="text-xs text-slate-500 sm:mb-1">Expenses</p>
            <p className="text-lg font-bold text-orange-400 tabular-nums sm:text-sm">
              {formatCurrency(yearSummary.totalExpenses, currency)}
            </p>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2.5 sm:block sm:border-0 sm:bg-transparent sm:p-0 sm:text-center">
            <p className="text-xs text-slate-500 sm:mb-1">Tax Reserve</p>
            <p className="text-lg font-bold text-amber-400 tabular-nums sm:text-sm">
              {formatCurrency(yearSummary.taxReserve, currency)}
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
