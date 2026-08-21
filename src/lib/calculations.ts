import type { Category, FinancialSummary, Settings, Transaction } from '../types'
import { categoryTaxRule } from './categoryTax'
import { roundCents } from './money'
import {
  businessAmountForIncomeTax,
  calculateHst,
  calculateOntarioSolePropTax,
  splitHst,
  type HstBreakdown,
  type TaxBreakdown,
} from './taxEngine'

export { isMealsCategory, isMileageLogCategory, deductionBadgeLabel } from './categoryTax'

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

function clampPercent(value: number | undefined): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(1, Math.max(0, (value as number) / 100))
}

function businessUseRate(useBasis: 'full' | 'vehicle' | 'phone', settings: Settings): number {
  if (useBasis === 'vehicle') return clampPercent(settings.vehicleBusinessUsePercent ?? 100)
  if (useBasis === 'phone') return clampPercent(settings.phoneInternetBusinessUsePercent ?? 100)
  return 1
}

export interface ExpenseTaxLine {
  cashAmount: number
  incomeTaxDeduction: number
  inputTaxCredit: number
  pretaxForDisplay: number
}

/**
 * CRA income-tax deduction and HST ITC for one expense line.
 * Meals: 50% deduction and 50% ITC; non-creditable HST stays in the deductible cost.
 * Mileage: log only (not deducted) so gas is not double-counted.
 */
export function expenseTaxLine(
  transaction: Transaction,
  category: Category | undefined,
  settings: Settings,
): ExpenseTaxLine {
  const cashAmount = roundCents(Math.max(0, transaction.amount))
  const empty = { cashAmount, incomeTaxDeduction: 0, inputTaxCredit: 0, pretaxForDisplay: 0 }

  if (transaction.type !== 'expense' || !transaction.isTaxDeductible) {
    return empty
  }

  const rule = categoryTaxRule(category)
  if (!rule.incomeTaxDeductible) return empty

  const useRate = businessUseRate(rule.useBasis, settings)
  const eligibleCash = roundCents(cashAmount * useRate)
  const registered = settings.hstRegistered
  const includesHst = registered && (settings.amountsIncludeHst ?? true)

  if (!registered || !rule.chargesHst) {
    const pretaxForDisplay = businessAmountForIncomeTax(eligibleCash, false, false)
    return {
      cashAmount,
      pretaxForDisplay,
      inputTaxCredit: 0,
      incomeTaxDeduction: roundCents(eligibleCash * rule.deductFraction),
    }
  }

  const split = splitHst(eligibleCash, includesHst)
  const itc = roundCents(split.hst * rule.itcFraction)
  const nonCreditableHst = roundCents(split.hst - itc)
  const costAfterItc = roundCents(split.net + nonCreditableHst)
  return {
    cashAmount,
    pretaxForDisplay: split.net,
    inputTaxCredit: itc,
    incomeTaxDeduction: roundCents(costAfterItc * rule.deductFraction),
  }
}

export function deductibleAmount(
  transaction: Transaction,
  categories: Category[],
  settings: Settings,
): number {
  const category = categories.find((c) => c.id === transaction.categoryId)
  return expenseTaxLine(transaction, category, settings).incomeTaxDeduction
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
  inputTaxCredits: number
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

  const expenseLines = expenses.map((t) => {
    const category = categories.find((c) => c.id === t.categoryId)
    return expenseTaxLine(t, category, settings)
  })

  const totalExpenses = roundCents(
    expenses.reduce(
      (sum, t) =>
        sum +
        businessAmountForIncomeTax(t.amount, settings.hstRegistered, settings.amountsIncludeHst),
      0,
    ),
  )
  const deductibleExpenses = roundCents(
    expenseLines.reduce((sum, line) => sum + line.incomeTaxDeduction, 0),
  )
  const inputTaxCredits = roundCents(
    expenseLines.reduce((sum, line) => sum + line.inputTaxCredit, 0),
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
    inputTaxCredits,
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

function hstForPeriod(
  settings: Settings,
  incomeAmounts: number[],
  inputTaxCredits: number,
  trailingRevenue: number,
): HstBreakdown {
  return calculateHst({
    registered: settings.hstRegistered,
    amountsIncludeHst: settings.amountsIncludeHst,
    incomeAmounts,
    deductibleExpenseAmounts: [],
    trailingRevenue,
    inputTaxCredits,
  })
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

  const employmentOnlyTax = otherIncome > 0 ? calculateOntarioSolePropTax(0, otherIncome) : emptyTax()
  const ytdBusinessReserve = roundCents(ytdTax.totalTaxReserve - employmentOnlyTax.incomeTax)
  const priorBusinessReserve =
    month === undefined
      ? 0
      : roundCents(
          priorTax.totalTaxReserve - (otherIncome > 0 ? employmentOnlyTax.incomeTax : 0),
        )

  const taxReserve =
    month === undefined ? ytdBusinessReserve : roundCents(ytdBusinessReserve - priorBusinessReserve)

  const trailingRevenue = trailingTwelveMonthRevenue(transactions, settings)
  const ytdHst = hstForPeriod(settings, ytd.incomeAmounts, ytd.inputTaxCredits, trailingRevenue)
  const priorHst =
    month === undefined
      ? emptyHst()
      : hstForPeriod(settings, priorYtd.incomeAmounts, priorYtd.inputTaxCredits, trailingRevenue)
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

  const effectiveBase = ytd.netProfit > 0 ? ytdBusinessReserve / ytd.netProfit : 0

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
    taxBreakdown: {
      ...ytdTax,
      totalTaxReserve: ytdBusinessReserve,
      effectiveRate: effectiveBase,
      planningRate: effectiveBase,
    },
    effectiveTaxRate: effectiveBase * 100,
    hst,
    hstSetAside: periodHstOwing,
    ytdNetProfit: ytd.netProfit,
    ytdTaxReserve: ytdBusinessReserve,
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
