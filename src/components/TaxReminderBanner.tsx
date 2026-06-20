import { Bell, CalendarClock, X } from 'lucide-react'
import { formatCurrency } from '../lib/format'
import { formatDueDate } from '../lib/taxReminders'
import type { QuarterlyTaxReminder } from '../types'

interface TaxReminderBannerProps {
  reminder: QuarterlyTaxReminder
  currency: string
  onDismiss: () => void
  onEnableNotifications?: () => void
  notificationsSupported: boolean
}

export function TaxReminderBanner({
  reminder,
  currency,
  onDismiss,
  onEnableNotifications,
  notificationsSupported,
}: TaxReminderBannerProps) {
  const isPast = reminder.isPastDue

  return (
    <section
      className={`rounded-2xl border p-4 ${
        isPast
          ? 'border-red-900/50 bg-red-950/30'
          : 'border-amber-900/50 bg-amber-950/30'
      }`}
    >
      <div className="flex items-start gap-3">
        <CalendarClock
          size={20}
          className={`shrink-0 mt-0.5 ${isPast ? 'text-red-400' : 'text-amber-400'}`}
        />
        <div className="flex-1 min-w-0">
          <h2 className={`text-sm font-semibold ${isPast ? 'text-red-200' : 'text-amber-200'}`}>
            {isPast ? 'Quarterly Tax Payment Overdue' : 'Quarterly Estimated Tax Due Soon'}
          </h2>
          <p className={`text-sm mt-1 ${isPast ? 'text-red-100/70' : 'text-amber-100/70'}`}>
            {reminder.label} payment due{' '}
            <strong>{formatDueDate(reminder.dueDate)}</strong>
            {isPast
              ? ` (${Math.abs(reminder.daysUntilDue)} days ago)`
              : ` (in ${reminder.daysUntilDue} days)`}
            . Based on your YTD net profit, set aside approximately{' '}
            <strong>{formatCurrency(reminder.estimatedPayment, currency)}</strong>.
          </p>

          {notificationsSupported && onEnableNotifications && (
            <button
              type="button"
              onClick={onEnableNotifications}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-amber-300 hover:text-amber-200"
            >
              <Bell size={14} />
              Enable payment reminders
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 shrink-0"
          aria-label="Dismiss reminder"
        >
          <X size={16} />
        </button>
      </div>
    </section>
  )
}
