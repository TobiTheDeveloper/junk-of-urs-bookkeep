import type { Category, FinancialSummary, Transaction } from '../types'
import { formatCurrency } from './format'

function escapeCsv(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportTransactionsCsv(
  transactions: Transaction[],
  categories: Category[],
  businessName: string,
) {
  const categoryName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? ''

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
      categoryName(tx.categoryId),
      tx.incomeSource ?? '',
      tx.client,
      tx.vendor,
      tx.isTaxDeductible ? 'Yes' : 'No',
      tx.notes,
      tx.receiptId ? 'Yes' : 'No',
    ])

  const slug = businessName.toLowerCase().replace(/\s+/g, '-')
  downloadCsv(`${slug}-transactions-${new Date().toISOString().slice(0, 10)}.csv`, [
    header,
    ...rows,
  ])
}

export function exportSummaryCsv(
  summary: FinancialSummary,
  periodLabel: string,
  businessName: string,
  currency: string,
) {
  const rows = [
    ['Business', businessName],
    ['Period', periodLabel],
    ['Currency', currency],
    ['Gross Income', formatCurrency(summary.grossIncome, currency)],
    ['Subcontractor Income', formatCurrency(summary.subcontractorIncome, currency)],
    ['Junk Removal Income', formatCurrency(summary.junkRemovalIncome, currency)],
    ['Total Expenses', formatCurrency(summary.totalExpenses, currency)],
    ['Deductible Expenses', formatCurrency(summary.deductibleExpenses, currency)],
    ['Net Profit (Taxable)', formatCurrency(summary.netProfit, currency)],
    ['Federal Income Tax', formatCurrency(summary.taxBreakdown.federalIncomeTax, currency)],
    ['Ontario Income Tax', formatCurrency(summary.taxBreakdown.ontarioIncomeTax, currency)],
    ['Ontario Health Premium', formatCurrency(summary.taxBreakdown.ontarioHealthPremium, currency)],
    ['CPP Contributions', formatCurrency(summary.taxBreakdown.cppContributions, currency)],
    ['Tax Reserve (Total)', formatCurrency(summary.taxReserve, currency)],
    ['Effective Tax Rate', `${summary.effectiveTaxRate.toFixed(1)}%`],
    ['Estimated Take-Home', formatCurrency(summary.takeHome, currency)],
  ]

  const slug = businessName.toLowerCase().replace(/\s+/g, '-')
  downloadCsv(`${slug}-summary-${periodLabel.replace(/\s+/g, '-').toLowerCase()}.csv`, rows)
}

export function exportCategoryBreakdownCsv(
  summary: FinancialSummary,
  categories: Category[],
  periodLabel: string,
  businessName: string,
  currency: string,
) {
  const header = ['Category', 'Amount', 'Currency', 'Period']
  const rows = Object.entries(summary.expenseByCategory)
    .map(([catId, amount]) => {
      const name = categories.find((c) => c.id === catId)?.name ?? 'Uncategorized'
      return [name, formatCurrency(amount, currency), currency, periodLabel]
    })
    .sort((a, b) => {
      const aNum = parseFloat(String(a[1]).replace(/[^0-9.-]/g, ''))
      const bNum = parseFloat(String(b[1]).replace(/[^0-9.-]/g, ''))
      return bNum - aNum
    })

  const slug = businessName.toLowerCase().replace(/\s+/g, '-')
  downloadCsv(`${slug}-expenses-by-category-${periodLabel.replace(/\s+/g, '-').toLowerCase()}.csv`, [
    header,
    ...rows,
  ])
}
