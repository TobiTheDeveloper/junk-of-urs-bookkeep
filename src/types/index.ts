import type { HstBreakdown, TaxBreakdown } from '../lib/taxEngine'

export type TransactionType = 'income' | 'expense'
export type IncomeSource = 'subcontractor' | 'junk_removal'
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'success'

export interface Category {
  id: string
  name: string
  icon: string
  color: string
  isDefault: boolean
  updatedAt: string
}

export interface Receipt {
  id: string
  transactionId: string
  imageData: string
  mimeType: string
  fileName: string
  storagePath: string | null
  createdAt: string
  updatedAt: string
}

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  date: string
  description: string
  categoryId: string | null
  incomeSource: IncomeSource | null
  vendor: string
  client: string
  receiptId: string | null
  isTaxDeductible: boolean
  notes: string
  importKey: string | null
  createdAt: string
  updatedAt: string
}

export interface Settings {
  id: string
  businessName: string
  businessStartDate: string
  /** Unused — tax is calculated from 2026 Ontario/federal rules, not a flat rate. */
  incomeTaxRate: number
  /** Unused — CPP is calculated from CRA 2026 amounts. */
  selfEmploymentRate: number
  fiscalYearStart: number
  currency: string
  quarterlyRemindersEnabled: boolean
  dismissedReminderKey: string | null
  lastSyncedAt: string | null
  updatedAt: string
  /** Collect and remit Ontario HST (13%). */
  hstRegistered: boolean
  /** Recorded amounts already include 13% HST (only used when registered). */
  amountsIncludeHst: boolean
  /** Other T4 wages this year — not Stage subcontract / T4A. Stacks on profit for brackets. */
  otherAnnualIncome: number
  /** Business kilometres / total kilometres (T2125 Chart A). Applied to fuel and vehicle maintenance. */
  vehicleBusinessUsePercent: number
  /** Business share of phone and internet bills. */
  phoneInternetBusinessUsePercent: number
}

export interface FinancialSummary {
  grossIncome: number
  subcontractorIncome: number
  junkRemovalIncome: number
  totalExpenses: number
  deductibleExpenses: number
  /** Business profit for the period (can be negative). */
  netProfit: number
  /** Tax to set aside for this period (incremental when viewing a month). */
  taxReserve: number
  takeHome: number
  expenseByCategory: Record<string, number>
  taxBreakdown: TaxBreakdown
  effectiveTaxRate: number
  hst: HstBreakdown
  /** HST to remit for this period (incremental when viewing a month). */
  hstSetAside: number
  /** Year-to-date through the end of the selected period. */
  ytdNetProfit: number
  ytdTaxReserve: number
}

export interface QuarterlyTaxReminder {
  key: string
  quarter: 1 | 2 | 3 | 4
  taxYear: number
  label: string
  dueDate: Date
  daysUntilDue: number
  estimatedPayment: number
  ytdNetProfit: number
  isDueSoon: boolean
  isPastDue: boolean
}

export type TabId = 'dashboard' | 'income' | 'expenses' | 'receipts' | 'reports' | 'settings'

export interface ExpensifyImportResult {
  imported: number
  skipped: number
  personal: number
  duplicates: number
  messages: string[]
}
