import type { Category, FinancialSummary, Settings, Transaction } from '../types'
import { roundCents } from './money'
import {
  businessAmountForIncomeTax,
  calculateHst,
  calculateOntarioSolePropTax,
  type HstBreakdown,
  type TaxBreakdown,
} from './taxEngine'

function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T12:00:00')
}

function isInYear(dateStr: string, year: number): boolean {
  return parseDate(dateStr).getFullYear() === year
}

function isInMonth(dateStr: string, year: number, month: number): boolean {
  const d = parseDate(dateStr)
  return d.getFullYear() === year && d.getMonth() + 1 === month
}

function isInYearThroughMonth(dateStr: string, year: number, throughMonth: number): boolean {
  const d = parseDate(dateStr)
  return d.getFullYear() === year && d.getMonth() + 1 <= throughMonth
}

export function isMealsCategory(category: Category | undefined): boolean {
  if (!category) return false
  const name = category.name.toLowerCase()
  return name.includes('meal') && (name.includes('50') || name.includes('deduct'))
}

export function deductibleAmount(
  transaction: Transaction,
  categories: Category[],
  settings: Settings,
): number {
  if (transaction.type !== 'expense' || !transaction.isTaxDeductible) return 0
  const pretax = businessAmountForIncomeTax(
    transaction.amount,
    settings.hstRegistered,
    settings.amountsIncludeHst,
  )
  const category = categories.find((c) => c.id === transaction.categoryId)
  if (isMealsCategory(category)) {
    return roundCents(pretax * 0.5)
  }
  return pretax
}

export function incomeAmountForTax(transaction: Transaction, settings: Settings): number {
  if (transaction.type !== 'income') return 0
  return businessAmountForIncomeTax(
    transaction.amount,
    settings.hstRegistered,
    settings.amountsIncludeHst,
  )
}

function trailingTwelveMonthRevenue(
  transactions: Transaction[],
  settings: Settings,
  asOf = new Date(),
): number {
  const end = asOf.getTime()
  const start = new Date(asOf)
  start.setFullYear(start.getFullYear() - 1)
  const startMs = start.getTime()

  return roundCents(
    transactions
      .filter((t) => t.type === 'income')
      .filter((t) => {
        const ms = parseDate(t.date).getTime()
        return ms >= startMs && ms <= end
      })
      .reduce((sum, t) => sum + incomeAmountForTax(t, settings), 0),
  )
}

function periodTotals(
  transactions: Transaction[],
  categories: Category[],
  settings: Settings,
): {
  grossIncome: number
  subcontractorIncome: number
  junkRemovalIncome: number
  totalExpenses: number
  deductibleExpenses: number
  netProfit: number
  recordedIncome: number
  recordedExpenses: number
  incomeAmounts: number[]
  deductibleExpenseAmounts: number[]
} {
  const income = transactions.filter((t) => t.type === 'income')
  const expenses = transactions.filter((t) => t.type === 'expense')

  const recordedIncome = roundCents(income.reduce((sum, t) => sum + t.amount, 0))
  const recordedExpenses = roundCents(expenses.reduce((sum, t) => sum + t.amount, 0))

  const grossIncome = roundCents(income.reduce((sum, t) => sum + incomeAmountForTax(t, settings), 0))
  const subcontractorIncome = roundCents(
    income
      .filter((t) => t.incomeSource === 'subcontractor')
      .reduce((sum, t) => sum + incomeAmountForTax(t, settings), 0),
  )
  const junkRemovalIncome = roundCents(
    income
      .filter((t) => t.incomeSource === 'junk_removal')
      .reduce((sum, t) => sum + incomeAmountForTax(t, settings), 0),
  )

  const totalExpenses = roundCents(
    expenses.reduce(
      (sum, t) =>
        sum +
        businessAmountForIncomeTax(t.amount, settings.hstRegistered, settings.amountsIncludeHst),
      0,
    ),
  )
  const deductibleExpenses = roundCents(
    expenses.reduce((sum, t) => sum + deductibleAmount(t, categories, settings), 0),
  )
  const netProfit = roundCents(grossIncome - deductibleExpenses)

  return {
    grossIncome,
    subcontractorIncome,
    junkRemovalIncome,
    totalExpenses,
    deductibleExpenses,
    netProfit,
    recordedIncome,
    recordedExpenses,
    incomeAmounts: income.map((t) => t.amount),
    deductibleExpenseAmounts: expenses
      .filter((t) => t.isTaxDeductible)
      .map((t) => t.amount),
  }
}

function emptyHst(): HstBreakdown {
  return calculateHst({
    registered: false,
    amountsIncludeHst: false,
    incomeAmounts: [],
    deductibleExpenseAmounts: [],
    trailingRevenue: 0,
  })
}

function emptyTax(): TaxBreakdown {
  return calculateOntarioSolePropTax(0, 0)
}

export function calculateSummary(
  transactions: Transaction[],
  categories: Category[],
  settings: Settings,
  year: number,
  month?: number,
): FinancialSummary {
  const yearTx = transactions.filter((t) => isInYear(t.date, year))
  const periodTx =
    month === undefined ? yearTx : yearTx.filter((t) => isInMonth(t.date, year, month))
  const ytdTx =
    month === undefined ? yearTx : yearTx.filter((t) => isInYearThroughMonth(t.date, year, month))
  const priorYtdTx =
    month === undefined || month <= 1
      ? []
      : yearTx.filter((t) => isInYearThroughMonth(t.date, year, month - 1))

  const period = periodTotals(periodTx, categories, settings)
  const ytd = periodTotals(ytdTx, categories, settings)
  const priorYtd = periodTotals(priorYtdTx, categories, settings)

  const otherIncome = settings.otherAnnualIncome ?? 0
  const ytdTax = calculateOntarioSolePropTax(ytd.netProfit, otherIncome)
  const priorTax =
    month === undefined ? emptyTax() : calculateOntarioSolePropTax(priorYtd.netProfit, otherIncome)

  const taxReserve =
    month === undefined
      ? ytdTax.totalTaxReserve
      : roundCents(ytdTax.totalTaxReserve - priorTax.totalTaxReserve)

  const trailingRevenue = trailingTwelveMonthRevenue(transactions, settings)
  const ytdHst = calculateHst({
    registered: settings.hstRegistered,
    amountsIncludeHst: settings.amountsIncludeHst,
    incomeAmounts: ytd.incomeAmounts,
    deductibleExpenseAmounts: ytd.deductibleExpenseAmounts,
    trailingRevenue,
  })
  const priorHst =
    month === undefined
      ? emptyHst()
      : calculateHst({
          registered: settings.hstRegistered,
          amountsIncludeHst: settings.amountsIncludeHst,
          incomeAmounts: priorYtd.incomeAmounts,
          deductibleExpenseAmounts: priorYtd.deductibleExpenseAmounts,
          trailingRevenue,
        })
  const hst = ytdHst
  const periodHstOwing =
    month === undefined
      ? ytdHst.netHstOwing
      : roundCents(ytdHst.netHstOwing - priorHst.netHstOwing)

  const recordedNetCash = roundCents(period.recordedIncome - period.recordedExpenses)
  const takeHome = roundCents(recordedNetCash - taxReserve - Math.max(0, periodHstOwing))

  const expenseByCategory: Record<string, number> = {}
  for (const expense of periodTx.filter((t) => t.type === 'expense')) {
    const key = expense.categoryId ?? 'uncategorized'
    expenseByCategory[key] = roundCents((expenseByCategory[key] ?? 0) + expense.amount)
  }

  return {
    grossIncome: period.grossIncome,
    subcontractorIncome: period.subcontractorIncome,
    junkRemovalIncome: period.junkRemovalIncome,
    totalExpenses: period.totalExpenses,
    deductibleExpenses: period.deductibleExpenses,
    netProfit: period.netProfit,
    taxReserve,
    takeHome,
    expenseByCategory,
    taxBreakdown: ytdTax,
    effectiveTaxRate: ytdTax.effectiveRate * 100,
    hst,
    hstSetAside: periodHstOwing,
    ytdNetProfit: ytd.netProfit,
    ytdTaxReserve: ytdTax.totalTaxReserve,
  }
}

export function getCurrentTaxYear(fiscalYearStart: number): { year: number; month: number } {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  if (fiscalYearStart > 1 && month < fiscalYearStart) {
    return { year: year - 1, month }
  }
  return { year, month }
}
