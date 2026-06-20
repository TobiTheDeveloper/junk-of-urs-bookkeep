import type { ExpensifyImportResult } from '../types'

export interface ParsedExpensifyRow {
  date: string
  merchant: string
  amount: number
  expensifyCategory: string
  receiptUrl: string
  importKey: string
}

const FUEL_MERCHANTS =
  /shell|petro|ultramar|esso|pioneer gas|circle k|gas bar|fuel|canada products/i
const PERSONAL_MERCHANTS =
  /disney\+?|fashionnova|amazon\.ca prime|jian hing|foodmart|food basics|no frills|huda halal|slay|kakobuy|caribbean queen|suya spot|baskin|klingai|perplexity|spaceship domain|mto serviceon|air-serv|rfbt-fairview|rfbt-shops|on\*kakobuy|sp fashionnova|walmart(?!.*supplies)/i
const MEAL_MERCHANTS =
  /mcdonald|wendy|tim hortons|uber eats|ubereats|hakka|levy|korean grill|patties|harveys|osmow|wing spot|moxies|metro 808|leslie keg|pioneer(?! gas)/i
const TRAVEL_MERCHANTS = /lyft|uber(?! eats)/i
const TOOL_MERCHANTS = /home depot|dollarama|walmart|amazon\.ca(?! prime)/i
const SOFTWARE_MERCHANTS = /openai|open ai/i

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

export function parseExpensifyCsv(csvText: string): ParsedExpensifyRow[] {
  const lines = csvText.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  const header = parseCsvLine(lines[0])
  const dateIdx = header.indexOf('Date')
  const merchantIdx = header.indexOf('Merchant')
  const amountIdx = header.indexOf('Amount')
  const categoryIdx = header.indexOf('Category')
  const receiptIdx = header.indexOf('Receipt')

  if (dateIdx === -1 || merchantIdx === -1 || amountIdx === -1) return []

  const rows: ParsedExpensifyRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    const date = cols[dateIdx]?.trim()
    const merchant = cols[merchantIdx]?.trim()
    const amount = parseFloat(cols[amountIdx]?.trim() ?? '')
    if (!date || !merchant || Number.isNaN(amount) || amount <= 0) continue

    rows.push({
      date,
      merchant,
      amount,
      expensifyCategory: cols[categoryIdx]?.trim() ?? '',
      receiptUrl: cols[receiptIdx]?.trim() ?? '',
      importKey: `expensify:${date}:${merchant.toLowerCase()}:${amount.toFixed(2)}`,
    })
  }
  return rows
}

export interface ClassifiedExpense {
  categoryName: string
  isTaxDeductible: boolean
  skip: boolean
  skipReason?: string
  notes: string
}

export function classifyExpensifyExpense(row: ParsedExpensifyRow): ClassifiedExpense {
  const { merchant, expensifyCategory } = row
  const cat = expensifyCategory.toLowerCase()
  const merch = merchant.toLowerCase()

  if (PERSONAL_MERCHANTS.test(merchant)) {
    return { categoryName: 'Other', isTaxDeductible: false, skip: true, skipReason: 'personal', notes: '' }
  }

  if (FUEL_MERCHANTS.test(merchant) || cat === 'car') {
    return {
      categoryName: 'Fuel & Gas',
      isTaxDeductible: true,
      skip: false,
      notes: `Expensify: ${expensifyCategory || 'Car'}`,
    }
  }

  if (TRAVEL_MERCHANTS.test(merchant) || cat === 'professional services' || cat === 'travel') {
    if (MEAL_MERCHANTS.test(merchant)) {
      return {
        categoryName: 'Meals (50% deductible)',
        isTaxDeductible: true,
        skip: false,
        notes: `Expensify: ${expensifyCategory}`,
      }
    }
    return {
      categoryName: 'Travel & Rides',
      isTaxDeductible: true,
      skip: false,
      notes: `Expensify: ${expensifyCategory}`,
    }
  }

  if (SOFTWARE_MERCHANTS.test(merchant)) {
    return {
      categoryName: 'Office & Admin',
      isTaxDeductible: true,
      skip: false,
      notes: 'Business software subscription',
    }
  }

  if (TOOL_MERCHANTS.test(merchant) || cat === 'materials') {
    if (MEAL_MERCHANTS.test(merchant)) {
      return {
        categoryName: 'Meals (50% deductible)',
        isTaxDeductible: true,
        skip: false,
        notes: `Expensify: ${expensifyCategory}`,
      }
    }
    return {
      categoryName: 'Equipment & Tools',
      isTaxDeductible: true,
      skip: false,
      notes: `Expensify: ${expensifyCategory || 'Materials'}`,
    }
  }

  if (cat === 'meals and entertainment' || MEAL_MERCHANTS.test(merchant)) {
    return {
      categoryName: 'Meals (50% deductible)',
      isTaxDeductible: true,
      skip: false,
      notes: `Expensify: ${expensifyCategory}`,
    }
  }

  if (cat === 'uncategorized' || cat === 'utilities' || cat === 'other') {
    if (merch.includes('openai')) {
      return {
        categoryName: 'Office & Admin',
        isTaxDeductible: true,
        skip: false,
        notes: 'Business software',
      }
    }
    return {
      categoryName: 'Other',
      isTaxDeductible: false,
      skip: true,
      skipReason: 'uncategorized',
      notes: '',
    }
  }

  return {
    categoryName: 'Other',
    isTaxDeductible: false,
    skip: true,
    skipReason: 'unknown',
    notes: '',
  }
}

export function summarizeImportResult(result: ExpensifyImportResult): string {
  return `Imported ${result.imported} business expenses. Skipped ${result.personal} personal, ${result.duplicates} duplicates, ${result.skipped} other.`
}

export function filterFromBusinessStart(
  rows: ParsedExpensifyRow[],
  businessStartDate: string,
): ParsedExpensifyRow[] {
  return rows.filter((r) => r.date >= businessStartDate)
}

export function dedupeExpensifyRows(rows: ParsedExpensifyRow[]): ParsedExpensifyRow[] {
  const seen = new Set<string>()
  const result: ParsedExpensifyRow[] = []
  for (const row of rows) {
    if (seen.has(row.importKey)) continue
    seen.add(row.importKey)
    result.push(row)
  }
  return result
}
