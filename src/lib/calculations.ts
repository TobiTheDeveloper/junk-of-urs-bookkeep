import type { Category, FinancialSummary, Settings, Transaction } from '../types'
import { calculateOntarioSolePropTax } from './taxEngine'

function isInPeriod(dateStr: string, year: number, month?: number): boolean {
  const d = new Date(dateStr + 'T12:00:00')
  if (month !== undefined) {
    return d.getFullYear() === year && d.getMonth() + 1 === month
  }
  return d.getFullYear() === year
}

function deductibleAmount(transaction: Transaction, categories: Category[]): number {
  if (!transaction.isTaxDeductible) return 0
  const category = categories.find((c) => c.id === transaction.categoryId)
  if (category?.name === 'Meals (50% deductible)') {
    return transaction.amount * 0.5
  }
  return transaction.amount
}

export function calculateSummary(
  transactions: Transaction[],
  categories: Category[],
  _settings: Settings,
  year: number,
  month?: number,
): FinancialSummary {
  const filtered = transactions.filter((t) => isInPeriod(t.date, year, month))

  const income = filtered.filter((t) => t.type === 'income')
  const expenses = filtered.filter((t) => t.type === 'expense')

  const grossIncome = income.reduce((sum, t) => sum + t.amount, 0)
  const subcontractorIncome = income
    .filter((t) => t.incomeSource === 'subcontractor')
    .reduce((sum, t) => sum + t.amount, 0)
  const junkRemovalIncome = income
    .filter((t) => t.incomeSource === 'junk_removal')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0)
  const deductibleExpenses = expenses.reduce(
    (sum, t) => sum + deductibleAmount(t, categories),
    0,
  )

  const netProfit = Math.max(0, grossIncome - deductibleExpenses)
  const taxBreakdown = calculateOntarioSolePropTax(netProfit)
  const taxReserve = taxBreakdown.totalTaxReserve
  const takeHome = grossIncome - totalExpenses - taxReserve

  const expenseByCategory: Record<string, number> = {}
  for (const expense of expenses) {
    const key = expense.categoryId ?? 'uncategorized'
    expenseByCategory[key] = (expenseByCategory[key] ?? 0) + expense.amount
  }

  return {
    grossIncome,
    subcontractorIncome,
    junkRemovalIncome,
    totalExpenses,
    deductibleExpenses,
    netProfit,
    taxReserve,
    takeHome,
    expenseByCategory,
    taxBreakdown,
    effectiveTaxRate: taxBreakdown.effectiveRate * 100,
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
