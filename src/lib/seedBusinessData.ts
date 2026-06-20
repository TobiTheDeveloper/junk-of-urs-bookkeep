import { db, getCategoryIdByName, nowIso } from '../db/database'
import { assertAuthenticated } from './authGuard'
import {
  findExistingTransaction,
  removeDuplicateTransactions,
} from './dedupe'
import { scheduleSync } from './sync'
import { ONTARIO_SOLE_PROP_TAX } from './taxReminders'
import type { ExpensifyImportResult, Transaction } from '../types'
import {
  classifyExpensifyExpense,
  dedupeExpensifyRows,
  filterFromBusinessStart,
  parseExpensifyCsv,
  type ParsedExpensifyRow,
} from './expensifyImport'

interface SeedExpense {
  date: string
  vendor: string
  amount: number
  categoryName: string
  description: string
  isTaxDeductible: boolean
  importKey: string
  notes?: string
}

interface SeedIncome {
  date: string
  amount: number
  description: string
  client: string
  incomeSource: 'subcontractor' | 'junk_removal'
  importKey: string
}

export const JUNE_2026_EXPENSES: SeedExpense[] = [
  { date: '2026-06-03', vendor: 'Shell', amount: 14.81, categoryName: 'Fuel & Gas', description: 'Fuel', isTaxDeductible: true, importKey: 'expensify:2026-06-03:shell:14.81' },
  { date: '2026-06-07', vendor: 'Shell Canada Products', amount: 72.9, categoryName: 'Fuel & Gas', description: 'Fuel', isTaxDeductible: true, importKey: 'expensify:2026-06-07:shell canada products:72.90' },
  { date: '2026-06-07', vendor: 'Shell', amount: 68.43, categoryName: 'Fuel & Gas', description: 'Fuel', isTaxDeductible: true, importKey: 'expensify:2026-06-07:shell:68.43' },
  { date: '2026-06-07', vendor: "McDonald's", amount: 20.31, categoryName: 'Meals (50% deductible)', description: 'Work meal', isTaxDeductible: true, importKey: 'expensify:2026-06-07:mcdonald\'s:20.31' },
  { date: '2026-06-08', vendor: 'Uber Eats', amount: 47.41, categoryName: 'Meals (50% deductible)', description: 'Work meal delivery', isTaxDeductible: true, importKey: 'expensify:2026-06-08:uber eats:47.41' },
  { date: '2026-06-08', vendor: 'Uber', amount: 1.33, categoryName: 'Travel & Rides', description: 'Work travel', isTaxDeductible: true, importKey: 'expensify:2026-06-08:uber:1.33' },
  { date: '2026-06-10', vendor: 'Uber Eats', amount: 32.23, categoryName: 'Meals (50% deductible)', description: 'Work meal delivery', isTaxDeductible: true, importKey: 'expensify:2026-06-10:uber eats:32.23' },
  { date: '2026-06-11', vendor: 'Levy Canada', amount: 21.49, categoryName: 'Meals (50% deductible)', description: 'Work meal', isTaxDeductible: true, importKey: 'expensify:2026-06-11:levy canada:21.49' },
  { date: '2026-06-12', vendor: 'Hakka Legend', amount: 20.34, categoryName: 'Meals (50% deductible)', description: 'Work meal', isTaxDeductible: true, importKey: 'expensify:2026-06-12:hakka legend:20.34' },
  { date: '2026-06-12', vendor: 'OpenAI', amount: 12.43, categoryName: 'Office & Admin', description: 'Business AI subscription', isTaxDeductible: true, importKey: 'expensify:2026-06-12:openai:12.43' },
  { date: '2026-06-13', vendor: 'Korean Grill House Midland', amount: 15.24, categoryName: 'Meals (50% deductible)', description: 'Work meal', isTaxDeductible: true, importKey: 'expensify:2026-06-13:korean grill house midland:15.24' },
  { date: '2026-06-13', vendor: "Wendy's", amount: 20.09, categoryName: 'Meals (50% deductible)', description: 'Work meal', isTaxDeductible: true, importKey: 'expensify:2026-06-13:wendy\'s:20.09' },
  { date: '2026-06-14', vendor: 'Shell', amount: 53.59, categoryName: 'Fuel & Gas', description: 'Fuel', isTaxDeductible: true, importKey: 'expensify:2026-06-14:shell:53.59' },
  { date: '2026-06-15', vendor: 'The Home Depot', amount: 241.77, categoryName: 'Equipment & Tools', description: 'Job supplies & equipment', isTaxDeductible: true, importKey: 'expensify:2026-06-15:the home depot:241.77' },
  { date: '2026-06-16', vendor: 'Tim Hortons', amount: 8.0, categoryName: 'Meals (50% deductible)', description: 'Work meal', isTaxDeductible: true, importKey: 'expensify:2026-06-16:tim hortons:8.00' },
  { date: '2026-06-16', vendor: 'Lyft', amount: 9.57, categoryName: 'Travel & Rides', description: 'Work travel', isTaxDeductible: true, importKey: 'expensify:2026-06-16:lyft:9.57' },
  { date: '2026-06-17', vendor: 'Tim Hortons', amount: 13.18, categoryName: 'Meals (50% deductible)', description: 'Work meal', isTaxDeductible: true, importKey: 'expensify:2026-06-17:tim hortons:13.18' },
  { date: '2026-06-17', vendor: 'Lyft', amount: 11.96, categoryName: 'Travel & Rides', description: 'Work travel', isTaxDeductible: true, importKey: 'expensify:2026-06-17:lyft:11.96' },
  {
    date: '2026-06-19',
    vendor: 'Mileage Tracker',
    amount: 760.0,
    categoryName: 'Mileage',
    description: 'Business mileage Jun 1 – Jun 19, 2026',
    isTaxDeductible: true,
    importKey: 'mileage:2026-06-01:2026-06-19:760.00',
    notes: 'Mileage log — CRA reasonable records (no receipt required)',
  },
]

export const JUNE_2026_INCOME: SeedIncome[] = [
  {
    date: '2026-06-06',
    amount: 1350.45,
    description: 'Invoice #001 — Subcontractor work',
    client: 'Subcontractor client',
    incomeSource: 'subcontractor',
    importKey: 'income:invoice-001',
  },
  {
    date: '2026-06-12',
    amount: 1262.25,
    description: 'Invoice #002 — Subcontractor work',
    client: 'Subcontractor client',
    incomeSource: 'subcontractor',
    importKey: 'income:invoice-002',
  },
  {
    date: '2026-06-19',
    amount: 1185.75,
    description: 'Invoice #003 — Subcontractor work',
    client: 'Subcontractor client',
    incomeSource: 'subcontractor',
    importKey: 'income:invoice-003',
  },
  {
    date: '2026-06-19',
    amount: 210.0,
    description: 'Junk removal job — June 19, 2026',
    client: 'Junk removal customer',
    incomeSource: 'junk_removal',
    importKey: 'income:junk-removal-001',
  },
]

async function upsertExpense(item: SeedExpense): Promise<'imported' | 'updated' | 'duplicate'> {
  assertAuthenticated()
  const existing = await findExistingTransaction({
    type: 'expense',
    date: item.date,
    amount: item.amount,
    vendor: item.vendor,
    client: '',
    description: item.description,
    incomeSource: null,
    importKey: item.importKey,
  })

  const categoryId = await getCategoryIdByName(item.categoryName)
  if (!categoryId) throw new Error(`Missing category: ${item.categoryName}`)

  const now = nowIso()
  if (existing) {
    await db.transactions.update(existing.id, {
      categoryId,
      description: item.description,
      vendor: item.vendor,
      isTaxDeductible: item.isTaxDeductible,
      notes: item.notes ?? '',
      importKey: item.importKey,
      updatedAt: now,
    })
    return existing.importKey === item.importKey ? 'duplicate' : 'updated'
  }

  const tx: Transaction = {
    id: crypto.randomUUID(),
    type: 'expense',
    amount: item.amount,
    date: item.date,
    description: item.description,
    categoryId,
    incomeSource: null,
    vendor: item.vendor,
    client: '',
    receiptId: null,
    isTaxDeductible: item.isTaxDeductible,
    notes: item.notes ?? '',
    importKey: item.importKey,
    createdAt: now,
    updatedAt: now,
  }
  await db.transactions.add(tx)
  return 'imported'
}

async function upsertIncome(item: SeedIncome): Promise<'imported' | 'updated' | 'duplicate'> {
  assertAuthenticated()
  const existing = await findExistingTransaction({
    type: 'income',
    date: item.date,
    amount: item.amount,
    vendor: '',
    client: item.client,
    description: item.description,
    incomeSource: item.incomeSource,
    importKey: item.importKey,
  })

  const now = nowIso()
  if (existing) {
    await db.transactions.update(existing.id, {
      date: item.date,
      amount: item.amount,
      description: item.description,
      client: item.client,
      incomeSource: item.incomeSource,
      importKey: item.importKey,
      updatedAt: now,
    })
    return 'duplicate'
  }

  const tx: Transaction = {
    id: crypto.randomUUID(),
    type: 'income',
    amount: item.amount,
    date: item.date,
    description: item.description,
    categoryId: null,
    incomeSource: item.incomeSource,
    vendor: '',
    client: item.client,
    receiptId: null,
    isTaxDeductible: false,
    notes: '',
    importKey: item.importKey,
    createdAt: now,
    updatedAt: now,
  }
  await db.transactions.add(tx)
  return 'imported'
}

export async function importExpensifyCsv(
  csvText: string,
  businessStartDate: string,
): Promise<ExpensifyImportResult> {
  assertAuthenticated()
  const parsed = dedupeExpensifyRows(
    filterFromBusinessStart(parseExpensifyCsv(csvText), businessStartDate),
  )

  const result: ExpensifyImportResult = {
    imported: 0,
    skipped: 0,
    personal: 0,
    duplicates: 0,
    messages: [],
  }

  for (const row of parsed) {
    const classified = classifyExpensifyExpense(row)
    if (classified.skip) {
      if (classified.skipReason === 'personal') result.personal++
      else result.skipped++
      continue
    }

    const status = await upsertExpense({
      date: row.date,
      vendor: row.merchant,
      amount: row.amount,
      categoryName: classified.categoryName,
      description: row.merchant,
      isTaxDeductible: classified.isTaxDeductible,
      importKey: row.importKey,
      notes: classified.notes,
    })

    if (status === 'imported') result.imported++
    else result.duplicates++
  }

  if (result.imported > 0) scheduleSync()
  await removeDuplicateTransactions()
  return result
}

export async function seedJune2026BusinessData(): Promise<
  ExpensifyImportResult & { incomeImported: number; duplicatesRemoved: number }
> {
  assertAuthenticated()
  const result: ExpensifyImportResult & { incomeImported: number; duplicatesRemoved: number } = {
    imported: 0,
    skipped: 0,
    personal: 0,
    duplicates: 0,
    incomeImported: 0,
    duplicatesRemoved: 0,
    messages: [],
  }

  await db.settings.update('main', {
    businessStartDate: '2026-06-01',
    currency: 'CAD',
    incomeTaxRate: ONTARIO_SOLE_PROP_TAX.incomeTaxRate,
    selfEmploymentRate: ONTARIO_SOLE_PROP_TAX.cppRate,
    updatedAt: nowIso(),
  })

  result.duplicatesRemoved = await removeDuplicateTransactions()

  for (const expense of JUNE_2026_EXPENSES) {
    const status = await upsertExpense(expense)
    if (status === 'imported') result.imported++
    else result.duplicates++
  }

  for (const income of JUNE_2026_INCOME) {
    const status = await upsertIncome(income)
    if (status === 'imported') result.incomeImported++
    else result.duplicates++
  }

  result.duplicatesRemoved += await removeDuplicateTransactions()

  if (result.imported > 0 || result.incomeImported > 0) scheduleSync()

  result.messages.push(
    `Synced ${result.imported} expenses and ${result.incomeImported} income entries. Skipped ${result.duplicates} duplicates. Removed ${result.duplicatesRemoved} extra copies.`,
  )
  return result
}

export function analyzeExpensifyCsv(csvText: string, businessStartDate: string) {
  const rows = dedupeExpensifyRows(
    filterFromBusinessStart(parseExpensifyCsv(csvText), businessStartDate),
  )

  let business = 0
  let personal = 0
  let businessTotal = 0
  let deductibleTotal = 0
  const byCategory: Record<string, number> = {}

  for (const row of rows) {
    const c = classifyExpensifyExpense(row)
    if (c.skip) {
      personal++
      continue
    }
    business++
    businessTotal += row.amount
    const deduct =
      c.categoryName === 'Meals (50% deductible)' ? row.amount * 0.5 : row.amount
    deductibleTotal += deduct
    byCategory[c.categoryName] = (byCategory[c.categoryName] ?? 0) + row.amount
  }

  return { business, personal, businessTotal, deductibleTotal, byCategory, totalRows: rows.length }
}

export type { ParsedExpensifyRow }
