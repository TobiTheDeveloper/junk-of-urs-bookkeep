import { useEffect, useMemo } from 'react'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Wallet,
  Briefcase,
  Truck,
} from 'lucide-react'
import { StatCard } from '../components/StatCard'
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

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Income"
          value={formatCurrency(summary.grossIncome, currency)}
          subtext="This month"
          icon={TrendingUp}
          variant="income"
        />
        <StatCard
          label="Expenses"
          value={formatCurrency(summary.totalExpenses, currency)}
          subtext="This month"
          icon={TrendingDown}
          variant="expense"
        />
        <StatCard
          label="Set Aside for Taxes"
          value={formatCurrency(summary.taxReserve, currency)}
          subtext={`${settings.incomeTaxRate + settings.selfEmploymentRate}% of net profit`}
          icon={PiggyBank}
          variant="tax"
        />
        <StatCard
          label="Estimated Take-Home"
          value={formatCurrency(summary.takeHome, currency)}
          subtext="After expenses & tax reserve"
          icon={Wallet}
          variant="takehome"
        />
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Income by Source (this month)</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Briefcase size={16} className="text-indigo-400" />
              Subcontractor Work
            </div>
            <span className="font-semibold text-white">
              {formatCurrency(summary.subcontractorIncome, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Truck size={16} className="text-lime-400" />
              Junk Removal (Jun 19)
            </div>
            <span className="font-semibold text-white">
              {formatCurrency(summary.junkRemovalIncome, currency)}
            </span>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-900/40 bg-amber-950/20 p-4">
        <div className="flex items-start gap-3">
          <PiggyBank size={20} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-amber-200">Tax Reserve Reminder</h2>
            <p className="text-sm text-amber-100/70 mt-1">
              As a solo proprietorship, set aside{' '}
              <strong className="text-amber-200">
                {formatCurrency(yearSummary.taxReserve, currency)}
              </strong>{' '}
              for taxes on your {year} net profit of{' '}
              {formatCurrency(yearSummary.netProfit, currency)}. Adjust rates in Settings.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Estimated Quarterly Payments ({year})</h2>
        <div className="space-y-2">
          {allQuarterReminders.map((q) => (
            <div key={q.key} className="flex items-center justify-between text-sm">
              <span className="text-slate-400">{q.label}</span>
              <span className="font-semibold text-white">
                {formatCurrency(q.estimatedPayment, currency)}
              </span>
            </div>
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
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {tx.description || (tx.type === 'income' ? 'Income' : 'Expense')}
                  </p>
                  <p className="text-xs text-slate-500">{formatShortDate(tx.date)}</p>
                </div>
                <span
                  className={`font-semibold shrink-0 ${
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
        <div className="flex items-center gap-2 mb-2">
          <DollarSign size={16} className="text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-300">Year-to-Date ({year})</h2>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-slate-500">Income</p>
            <p className="text-sm font-bold text-emerald-400">
              {formatCurrency(yearSummary.grossIncome, currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Expenses</p>
            <p className="text-sm font-bold text-orange-400">
              {formatCurrency(yearSummary.totalExpenses, currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Tax Reserve</p>
            <p className="text-sm font-bold text-amber-400">
              {formatCurrency(yearSummary.taxReserve, currency)}
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
