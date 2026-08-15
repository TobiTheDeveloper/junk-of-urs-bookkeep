import JSZip from 'jszip'
import type { Category, FinancialSummary, Settings, Transaction } from '../types'
import { calculateSummary } from './calculations'
import { normalizeCategoryName } from './dedupe'
import { formatCurrency } from './format'

function escapeCsv(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function rowsToCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n')
}

function slugify(businessName: string): string {
  return businessName.toLowerCase().replace(/\s+/g, '-')
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function downloadCsv(filename: string, rows: string[][]) {
  downloadBlob(filename, new Blob([rowsToCsv(rows)], { type: 'text/csv;charset=utf-8;' }))
}

function categoryName(categories: Category[], id: string | null): string {
  return categories.find((c) => c.id === id)?.name ?? ''
}

export function filterTransactionsByYear(transactions: Transaction[], year: number): Transaction[] {
  return transactions.filter(
    (t) => new Date(t.date + 'T12:00:00').getFullYear() === year,
  )
}

function buildSummaryRows(
  summary: FinancialSummary,
  periodLabel: string,
  businessName: string,
  currency: string,
): string[][] {
  return [
    ['Business', businessName],
    ['Period', periodLabel],
    ['Currency', currency],
    ['Generated', new Date().toISOString()],
    ['Gross Income', formatCurrency(summary.grossIncome, currency)],
    ['Subcontractor Income', formatCurrency(summary.subcontractorIncome, currency)],
    ['Junk Removal Income', formatCurrency(summary.junkRemovalIncome, currency)],
    ['Total Expenses', formatCurrency(summary.totalExpenses, currency)],
    ['Deductible Expenses', formatCurrency(summary.deductibleExpenses, currency)],
    ['Net Profit', formatCurrency(summary.netProfit, currency)],
    ['Taxable Income (after CPP deduction)', formatCurrency(summary.taxBreakdown.taxableIncome, currency)],
    ['Federal Income Tax', formatCurrency(summary.taxBreakdown.federalTax, currency)],
    ['Ontario Income Tax', formatCurrency(summary.taxBreakdown.ontarioTax, currency)],
    ['Ontario Surtax', formatCurrency(summary.taxBreakdown.ontarioSurtax, currency)],
    ['Ontario Health Premium', formatCurrency(summary.taxBreakdown.ontarioHealthPremium, currency)],
    ['CPP (self-employed both halves)', formatCurrency(summary.taxBreakdown.cpp.total, currency)],
    ['Effective Rate on Profit', `${summary.effectiveTaxRate.toFixed(1)}%`],
    ['Income Tax + CPP to Set Aside', formatCurrency(summary.taxReserve, currency)],
    ['HST Collected', formatCurrency(summary.hst.collected, currency)],
    ['HST ITCs', formatCurrency(summary.hst.inputTaxCredits, currency)],
    ['HST to Remit', formatCurrency(summary.hst.netHstOwing, currency)],
    ['Estimated Take-Home', formatCurrency(summary.takeHome, currency)],
    ['Tax notes', summary.taxBreakdown.planningTierLabel],
  ]
}

function buildCategoryRows(
  summary: FinancialSummary,
  categories: Category[],
  periodLabel: string,
  currency: string,
): string[][] {
  const merged = new Map<string, number>()

  for (const [catId, amount] of Object.entries(summary.expenseByCategory)) {
    const name = categories.find((c) => c.id === catId)?.name ?? 'Uncategorized'
    const key = normalizeCategoryName(name)
    merged.set(key, (merged.get(key) ?? 0) + amount)
  }

  const displayName = (key: string) => {
    const cat = categories.find((c) => normalizeCategoryName(c.name) === key)
    return cat?.name ?? key
  }

  const rows = Array.from(merged.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([key, amount]) => [displayName(key), formatCurrency(amount, currency), currency, periodLabel])

  return [['Category', 'Amount', 'Currency', 'Period'], ...rows]
}

function buildTransactionRows(transactions: Transaction[], categories: Category[]): string[][] {
  const header = [
    'Date',
    'Type',
    'Amount',
    'Description',
    'Category',
    'Income Source',
    'Client',
    'Vendor',
    'Tax Deductible',
    'Notes',
    'Has Receipt',
  ]

  const rows = transactions
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((tx) => [
      tx.date,
      tx.type,
      tx.amount.toFixed(2),
      tx.description,
      categoryName(categories, tx.categoryId),
      tx.incomeSource ?? '',
      tx.client,
      tx.vendor,
      tx.isTaxDeductible ? 'Yes' : 'No',
      tx.notes,
      tx.receiptId ? 'Yes' : 'No',
    ])

  return [header, ...rows]
}

function buildReadmeText(
  year: number,
  businessName: string,
  transactionCount: number,
  summary: FinancialSummary,
  currency: string,
): string {
  return [
    `${businessName} — ${year} Year-End Package`,
    `Generated: ${new Date().toLocaleString('en-CA')}`,
    '',
    'Files included:',
    `  01-summary-${year}.csv          Profit, tax reserve, take-home`,
    `  02-expenses-by-category-${year}.csv   Spending by category`,
    `  03-transactions-${year}.csv     Every income & expense line (${transactionCount} rows)`,
    '',
    `${year} totals:`,
    `  Gross income:    ${formatCurrency(summary.grossIncome, currency)}`,
    `  Total expenses:  ${formatCurrency(summary.totalExpenses, currency)}`,
    `  Net profit:      ${formatCurrency(summary.netProfit, currency)}`,
    `  Tax reserve:     ${formatCurrency(summary.taxReserve, currency)}`,
    '',
    'Ontario sole proprietorship — 2026 federal + Ontario income tax, Health Premium, and CPP estimate.',
    'HST is listed separately and is not income tax. Share all three CSV files with your accountant.',
  ].join('\n')
}

export function exportTransactionsCsv(
  transactions: Transaction[],
  categories: Category[],
  businessName: string,
  year?: number,
) {
  const filtered = year ? filterTransactionsByYear(transactions, year) : transactions
  const slug = slugify(businessName)
  const suffix = year ? `${year}` : new Date().toISOString().slice(0, 10)
  downloadCsv(`${slug}-transactions-${suffix}.csv`, buildTransactionRows(filtered, categories))
}

export function exportSummaryCsv(
  summary: FinancialSummary,
  periodLabel: string,
  businessName: string,
  currency: string,
) {
  const slug = slugify(businessName)
  downloadCsv(
    `${slug}-summary-${periodLabel.replace(/\s+/g, '-').toLowerCase()}.csv`,
    buildSummaryRows(summary, periodLabel, businessName, currency),
  )
}

export function exportCategoryBreakdownCsv(
  summary: FinancialSummary,
  categories: Category[],
  periodLabel: string,
  businessName: string,
  currency: string,
) {
  const slug = slugify(businessName)
  downloadCsv(
    `${slug}-expenses-by-category-${periodLabel.replace(/\s+/g, '-').toLowerCase()}.csv`,
    buildCategoryRows(summary, categories, periodLabel, currency),
  )
}

/** ZIP with summary, categories, and all transactions for one tax year. */
export async function exportYearEndAccountantPackage(
  year: number,
  transactions: Transaction[],
  categories: Category[],
  settings: Settings,
): Promise<void> {
  const periodLabel = `${year} (Full Year)`
  const currency = settings.currency
  const yearTransactions = filterTransactionsByYear(transactions, year)
  const summary = calculateSummary(transactions, categories, settings, year)
  const slug = slugify(settings.businessName)

  const zip = new JSZip()
  zip.file(`01-summary-${year}.csv`, rowsToCsv(buildSummaryRows(summary, periodLabel, settings.businessName, currency)))
  zip.file(
    `02-expenses-by-category-${year}.csv`,
    rowsToCsv(buildCategoryRows(summary, categories, periodLabel, currency)),
  )
  zip.file(`03-transactions-${year}.csv`, rowsToCsv(buildTransactionRows(yearTransactions, categories)))
  zip.file(
    'README.txt',
    buildReadmeText(year, settings.businessName, yearTransactions.length, summary, currency),
  )

  const blob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(`${slug}-accountant-package-${year}.zip`, blob)
}

export function getAvailableExportYears(transactions: Transaction[]): number[] {
  const set = new Set(transactions.map((t) => new Date(t.date + 'T12:00:00').getFullYear()))
  set.add(new Date().getFullYear())
  return Array.from(set).sort((a, b) => b - a)
}
