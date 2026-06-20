import type { Category, QuarterlyTaxReminder, Settings, Transaction } from '../types'
import { calculateSummary } from './calculations'

/** CRA personal income tax instalments (Ontario sole proprietorship) */
const CRA_INSTALMENT_DATES: { quarter: 1 | 2 | 3 | 4; month: number; day: number }[] = [
  { quarter: 1, month: 3, day: 15 },
  { quarter: 2, month: 6, day: 15 },
  { quarter: 3, month: 9, day: 15 },
  { quarter: 4, month: 12, day: 15 },
]

function quarterDueDate(taxYear: number, quarter: 1 | 2 | 3 | 4): Date {
  const config = CRA_INSTALMENT_DATES.find((q) => q.quarter === quarter)!
  return new Date(taxYear, config.month - 1, config.day, 23, 59, 59)
}

function reminderKey(taxYear: number, quarter: number) {
  return `${taxYear}-Q${quarter}`
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

function ytdNetProfitThroughQuarter(
  transactions: Transaction[],
  categories: Category[],
  settings: Settings,
  taxYear: number,
  quarter: 1 | 2 | 3 | 4,
): number {
  const endMonth = quarter * 3
  let total = 0
  for (let month = 1; month <= endMonth; month++) {
    total += calculateSummary(transactions, categories, settings, taxYear, month).netProfit
  }
  return total
}

export function getQuarterlyReminders(
  transactions: Transaction[],
  categories: Category[],
  settings: Settings,
  now = new Date(),
): QuarterlyTaxReminder[] {
  const taxYear = now.getFullYear()
  const combinedRate = (settings.incomeTaxRate + settings.selfEmploymentRate) / 100

  return ([1, 2, 3, 4] as const).map((quarter) => {
    const dueDate = quarterDueDate(taxYear, quarter)
    const daysUntilDue = daysBetween(now, dueDate)
    const ytdNetProfit = ytdNetProfitThroughQuarter(
      transactions,
      categories,
      settings,
      taxYear,
      quarter,
    )
    const estimatedPayment = Math.max(0, (ytdNetProfit * combinedRate) / 4)

    return {
      key: reminderKey(taxYear, quarter),
      quarter,
      taxYear,
      label: `Q${quarter} ${taxYear}`,
      dueDate,
      daysUntilDue,
      estimatedPayment,
      ytdNetProfit,
      isDueSoon: daysUntilDue >= 0 && daysUntilDue <= 21,
      isPastDue: daysUntilDue < 0 && daysUntilDue >= -30,
    }
  })
}

export function getActiveQuarterlyReminder(
  transactions: Transaction[],
  categories: Category[],
  settings: Settings,
): QuarterlyTaxReminder | null {
  if (!settings.quarterlyRemindersEnabled) return null

  const reminders = getQuarterlyReminders(transactions, categories, settings)
  const active = reminders.find((r) => r.isDueSoon || r.isPastDue)
  if (!active) return null
  if (settings.dismissedReminderKey === active.key) return null
  return active
}

export function formatDueDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export function maybeShowTaxNotification(reminder: QuarterlyTaxReminder, businessName: string) {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  const title = reminder.isPastDue
    ? `${businessName}: CRA instalment overdue`
    : `${businessName}: CRA instalment due soon`

  const body = `${reminder.label} estimated payment ~${reminder.estimatedPayment.toFixed(2)} due ${formatDueDate(reminder.dueDate)}`

  new Notification(title, { body, tag: reminder.key })
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

/** Ontario sole proprietorship default reserve rates (estimate). */
export const ONTARIO_SOLE_PROP_TAX = {
  /** Federal 15% + Ontario 5.05% on first income bracket */
  incomeTaxRate: 20.05,
  /** CPP self-employed contribution rate (2025/2026) */
  cppRate: 11.9,
  combinedRate: 31.95,
  hstRate: 13,
} as const

export function getOntarioTaxExplanation(): string {
  return `Ontario estimate uses ${ONTARIO_SOLE_PROP_TAX.incomeTaxRate}% combined federal + provincial income tax (lowest bracket) plus ${ONTARIO_SOLE_PROP_TAX.cppRate}% CPP on net self-employment income. HST (13%) is separate if you register. Adjust rates as income grows.`
}
