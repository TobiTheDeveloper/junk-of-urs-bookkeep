import type { TaxBreakdown } from '../lib/taxEngine'

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
  incomeTaxRate: number
  selfEmploymentRate: number
  fiscalYearStart: number
  currency: string
  quarterlyRemindersEnabled: boolean
  dismissedReminderKey: string | null
  lastSyncedAt: string | null
  updatedAt: string
}

export interface FinancialSummary {
  grossIncome: number
  subcontractorIncome: number
  junkRemovalIncome: number
  totalExpenses: number
  deductibleExpenses: number
  netProfit: number
  taxReserve: number
  takeHome: number
  expenseByCategory: Record<string, number>
  taxBreakdown: TaxBreakdown
  effectiveTaxRate: number
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
